var fs = require("fs"),
    request = require("request"),
    parse = require("csv-parse"),
    format = require("csv-stringify"),
    through = require("through"),
    extend = require("extend");

module.exports = function(input,output,options) {

  var addressCache = {}; //Cached results by address

  //Input CSV
  input = fs.createReadStream(input);

  //ex: geocode(inputFile)
  if (arguments.length === 1) {
    options = {};
    output = process.stdout;
  } else if (arguments.length === 2) {
    //ex: geocode(inputFile,{options})
    if (typeof output !== "string") {
      options = output;
      output = process.stdout;
    //ex: geocode(inputFile,outputFile)
    } else {
      options = {};
      output = fs.createWriteStream(output);
    }
  //ex: geocode(inputFile,outputFile,{options})
  } else {
    output = fs.createWriteStream(output);
  }

  //Default options
  options = extend({
    "verbose": false,
    "url": "https://maps.googleapis.com/maps/api/geocode/json?address=",
    "latColumn": null,
    "lngColumn": null,
    "addressColumn": null,
    "timeout": 250,
    "handler": googleHandler
  },options);

  //extend options with defaults
  input.pipe(parse({ columns: true }))
    .pipe(through(
      function write(row) {

        //If there are unset column names,
        //try to discover them on the first data row
        if (options.latColumn === null || options.lngColumn === null || options.addressColumn === null) {
          options = discover(options,row);
        }

        //Supplied address column doesn't exist
        if (row[options.addressColumn] === undefined) {
          throw new Error("Couldn't find address column '"+options.addressColumn+"'");
        }

        //Doesn't need geocoding
        if (numeric(row[options.latColumn]) && numeric(row[options.lngColumn])) {
          return this.queue(row);
        }

        //We've cached this address from a previous result
        if (addressCache[row[options.addressColumn]]) {

          row[options.latColumn] = addressCache[row[options.addressColumn]].lat;
          row[options.lngColumn] = addressCache[row[options.addressColumn]].lng;

          return this.queue(row);

        }

        //Pause stream b/c of API throttling
        this.pause();

        request.get(options.url+escaped(row[options.addressColumn]),function(err,response,body){

          var result;

          //Unknown HTTP error code
          if (err) {
            throw new Error(err);
          }

          result = options.processor(body);

          if (typeof result === "string") {

            row[options.latColumn] = "";
            row[options.lngColumn] = "";

            if (options.verbose) {
              console.warn("FAILED: "+row[options.addressColumn]+" ("+result+")");
            }
          } else if ("lat" in result && "lng" in result) {

            row[options.latColumn] = result.lat;
            row[options.lngColumn] = result.lng;

            //Cache the result
            addressCache[row[options.addressColumn]] = result;

          } else {
            throw new Error("Unknown error: couldn't extract result from response body:\n\n"+body);
          }

          setTimeout(function(){
            //Unpause stream
            this.queue(row);
            this.resume();
          }.bind(this),options.timeout);

        }.bind(this));
      },
      function end() {
        //figure out how to do summary reporting here
      }
    ))
    .pipe(format({ header: true }))
    .pipe(output);

};

function googleHandler(body) {

  var response = JSON.parse(body);

  //Error code
  if (response.status !== "OK") {
    return response.status;
  }

  //No results
  if (!response.results || !response.results.length) {
    return "NO MATCH";
  }

  //Success
  return response.results[0].geometry.location;

}

//Is numeric?
function numeric(number) {
  if (typeof number === "number") {
    return number <= 180 && number >= -180;
  } else if (typeof number === "string") {
    return number.length > 0 && !isNaN(+number) && +number <= 180 && +number >= -180;
  }
  return false;
}

//Escape address to include as GET parameter
function escaped(address) {
  return address.replace(/ /g,"+").replace(/[&]/g,"%26");
}

//Try to auto-discover missing column names
function discover(options,row) {

  for (var key in row) {
    if (options.latColumn === null && key.trim().match(/^lat(itude)?$/i)) {
      options.latColumn = key;
      continue;
    }
    if (options.lngColumn === null && key.trim().match(/^lo?ng(itude)?$/i)) {
      options.lngColumn = key;
      continue;
    }
    if (options.addressColumn === null && key.trim().match(/^(street[^a-z]*)?addr(ess)?$/i)) {
      options.addressColumn = key;
      continue;
    }
  }

  if (options.latColumn === null) {
    options.latColumn = "lat";
  }

  if (options.lngColumn === null) {
    options.lngColumn = "lng";
  }

  if (options.addressColumn === null) {
    throw new Error("Couldn't auto-detect address column.");
  }

  return options;

}