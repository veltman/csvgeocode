var fs = require("fs"),
    request = require("request"),
    parse = require("csv-parse"),
    format = require("csv-stringify"),
    queue = require("queue-async"),
    extend = require("extend");

var defaults = {
  "verbose": false,
  "url": "https://maps.googleapis.com/maps/api/geocode/json?address=",
  "latColumn": null,
  "lngColumn": null,
  "addressColumn": null,
  "timeout": 250,
  "force": false,
  "handler": googleHandler
};

module.exports = function(inFile,outFile,userOptions,onEnd) {

  var addressCache = {}, //Cached results by address
      q = queue(1),
      formatter = format({ header: true }),
      input = fs.createReadStream(inFile),
      output = process.stdout,
      options = {};

  if (arguments.length === 2) {
    if (typeof outFile === "string") {
      output = fs.createWriteStream(outFile);
    } else {
      options = outFile;
    }
  } else if (arguments.length === 3) {
    output = fs.createWriteStream(outFile);
    options = userOptions;
  }

  //Default options
  options = extend(defaults,options);

  formatter.pipe(output);

  //extend options with defaults
  input.pipe(parse({ columns: true }))
    .on("data",function(row){

      //If there are unset column names,
      //try to discover them on the first data row
      if (options.latColumn === null || options.lngColumn === null || options.addressColumn === null) {
        options = discover(options,row);
      }

      q.defer(geocode,row);


    })
    .on("end",function(){
      q.awaitAll(done);
    });

    function geocode(row,cb) {

      var cbgb = function(){
        return cb(null,!!(row.lat && row.lng));
      };

      //Supplied address column doesn't exist
      if (row[options.addressColumn] === undefined) {
        throw new Error("Couldn't find address column '"+options.addressColumn+"'");
      }

      //Doesn't need geocoding
      if (!options.force && numeric(row[options.latColumn]) && numeric(row[options.lngColumn])) {
        return formatter.write(row,cbgb);
      }

      //Address is cached from a previous result
      if (addressCache[row[options.addressColumn]]) {

        row[options.latColumn] = addressCache[row[options.addressColumn]].lat;
        row[options.lngColumn] = addressCache[row[options.addressColumn]].lng;

        return formatter.write(row,cbgb);

      }

      request.get(options.url+escaped(row[options.addressColumn]),function(err,response,body){

        var result;

        //Unknown HTTP error code
        if (err) {
          /* EMIT ERROR */
          throw new Error(err);
        }

        result = options.handler(body);

        if (typeof result === "string") {

          row[options.latColumn] = "";
          row[options.lngColumn] = "";

          /*
          EMIT ERROR
          if (options.verbose) {
            console.warn("FAILED: "+row[options.addressColumn]+" ("+result+")");
          }*/

        } else if ("lat" in result && "lng" in result) {

          row[options.latColumn] = result.lat;
          row[options.lngColumn] = result.lng;

          //Cache the result
          addressCache[row[options.addressColumn]] = result;

        } else {
          /* EMIT ERROR */
          throw new Error("Unknown error: couldn't extract result from response body:\n\n"+body);
        }

        return formatter.write(row,function(){
          setTimeout(cbgb,options.timeout);
        });

      });

    }

    function done(err,results) {
      console.log("DONE",err,results);
    }

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
  return !Array.isArray(number) && (number - parseFloat(number) + 1) >= 0 && number >= -180 && number <= 180;
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