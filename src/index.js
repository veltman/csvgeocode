var fs = require("fs"),
    request = require("request"),
    parse = require("csv-parse"),
    format = require("csv-stringify"),
    queue = require("queue-async"),
    extend = require("extend"),
    util = require("util"),
    EventEmitter = require("events").EventEmitter;

var defaults = {
  "verbose": false,
  "url": "https://maps.googleapis.com/maps/api/geocode/json?address={{a}}",
  "latColumn": null,
  "lngColumn": null,
  "addressColumn": null,
  "timeout": 250,
  "force": false,
  "handler": googleHandler
};

module.exports = generate;

function generate(inFile,outFile,userOptions) {

  var input = fs.createReadStream(inFile),
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

  var geocoder = new Geocoder(input,output,options);

  return geocoder.run();

};

var Geocoder = function(input,output,options) {

  this.input = input;
  this.output = output;
  this.options = options;

  this.queue = queue(1);
  this.cache = {}; //Cached results by address

};

util.inherits(Geocoder, EventEmitter);

Geocoder.prototype.run = function() {

  this.formatter = format({ header: true });
  this.parser = parse({ columns: true });
  this.time = (new Date()).getTime();

  this.formatter.pipe(this.output);

  //extend options with defaults
  this.input.pipe(this.parser)
    .on("data",function(row){

      this.emit("data",row);

      //If there are unset column names,
      //try to discover them on the first data row
      if (this.options.latColumn === null || this.options.lngColumn === null || this.options.addressColumn === null) {

        this.options = discover(this.options,row);

        if (this.options.addressColumn === null) {
          this.emit("err","Couldn't auto-detect address column.");
        }

      }

      this.queue.defer(this.code.bind(this),row);


    }.bind(this))
    .on("end",function(){
      this.queue.awaitAll(this.end.bind(this));
    }.bind(this));

  return this;

}

Geocoder.prototype.code = function(row,cb) {

  var cbgb = function(){
    return cb(null,!!(row.lat && row.lng));
  };

  if (row[this.options.addressColumn] === undefined) {
    this.emit("err","Couldn't find address column '"+this.options.addressColumn+"'");
    return this.formatter.write(row,cbgb);
  }

  //Doesn't need geocoding
  if (!this.options.force && numeric(row[this.options.latColumn]) && numeric(row[this.options.lngColumn])) {
    return this.formatter.write(row,cbgb);
  }

  //Address is cached from a previous result
  if (this.cache[row[this.options.addressColumn]]) {

    row[this.options.latColumn] = this.cache[row[this.options.addressColumn]].lat;
    row[this.options.lngColumn] = this.cache[row[this.options.addressColumn]].lng;

    return this.formatter.write(row,cbgb);

  }

  request.get(this.options.url.replace("{{a}}",escaped(row[this.options.addressColumn])),function(err,response,body){

    var result;

    //HTTP error
    if (err) {

      this.emit("err",err);

    } else if (response.statusCode !== 200) {

      this.emit("err","HTTP Status: "+response.statusCode);

    } else {

      try {
        result = this.options.handler(body);
      } catch(e) {
        this.emit("err",e);
      }

      //Error code
      if (typeof result === "string") {

        row[this.options.latColumn] = "";
        row[this.options.lngColumn] = "";

        this.emit("err",result);

      //Success
      } else if ("lat" in result && "lng" in result) {

        row[this.options.latColumn] = result.lat;
        row[this.options.lngColumn] = result.lng;

        //Cache the result
        this.cache[row[this.options.addressColumn]] = result;

      //Unknown extraction error
      } else {

        this.emit("err","Unknown error: couldn't extract result from response body:\n\n"+body);

      }

    }

    return this.formatter.write(row,function(){
      setTimeout(cbgb,this.options.timeout);
    }.bind(this));

  }.bind(this));

};

Geocoder.prototype.end = function(err,results){
  var failures = results.filter(function(d){
    return !d;
  }).length;

  this.emit("end",{
    failures: failures,
    successes: results.length - failures,
    time: prettyTime((new Date()).getTime() - this.time)
  });

}

function prettyTime(ms) {
  return (Math.round(ms/100)/10) + "s";
}

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

//Is it numeric and between -180 and +180?
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

  return options;

}