var misc = require("./misc"),
    defaults = require("./defaults"),
    handlers = require("./handlers"),
    fs = require("fs"),
    request = require("request"),
    parse = require("csv-parse"),
    format = require("csv-stringify"),
    queue = require("queue-async"),
    extend = require("extend"),
    util = require("util"),
    EventEmitter = require("events").EventEmitter;

module.exports = generate;

function generate(inFile,outFile,userOptions) {

  var input = inFile,
      output = null,
      options = {};

  if (arguments.length === 2) {
    if (typeof outFile === "string") {
      output = outFile;
    } else {
      options = outFile;
    }
  } else if (arguments.length === 3) {
    output = outFile;
    options = userOptions;
  }

  //Default options
  options = extend({},defaults,options);

  if (typeof options.handler === "string") {
    options.handler = options.handler.toLowerCase();
    if (handlers[options.handler]) {
      options.handler = handlers[options.handler];
    } else {
      throw new Error("Invalid value for 'handler' option.  Must be 'google', 'mapbox', or a function.");      
    }
  } else if (typeof options.handler !== "function") {
    throw new Error("Invalid value for 'handler' option.  Must be 'google', 'mapbox', or a function.");
  }

  var geocoder = new Geocoder(input,output,options);

  return geocoder.run();

};

var Geocoder = function(input,output,options) {

  this.input = input;
  this.output = output;
  this.options = options;
  this.cache = {}; //Cached results by address

};

util.inherits(Geocoder, EventEmitter);

Geocoder.prototype.run = function() {

  var q = queue(1),
      _this = this;

  this.time = (new Date()).getTime();

  fs.readFile(this.input,"utf8",fileRead);

  return this;


  function fileRead(err,csv) {

    if (err) {
      throw new Error(err);
    }

    parse(csv,{columns: true},csvParsed);

  }

  function csvParsed(err,parsed) {

    //If there are unset column names,
    //try to discover them on the first data row
    if (_this.options.lat === null || _this.options.lng === null || _this.options.address === null) {

      _this.options = misc.discoverOptions(_this.options,parsed[0]);

      if (_this.options.address === null) {
        throw new Error("Couldn't auto-detect address column.");
      }

    }

    parsed.forEach(function(row){
      q.defer(codeRow,row);
    });

    q.awaitAll(complete);

  }

  function codeRow(row,cb) {

    if (row[_this.options.address] === undefined) {
      _this.emit("row","Couldn't find address column '"+_this.options.address+"'",row);
      return cb(null,row);
    }

    //Doesn't need geocoding
    if (!_this.options.force && misc.isNumeric(row[_this.options.lat]) && misc.isNumeric(row[_this.options.lng])) {
      _this.emit("row",null,row);
      return cb(null,row);
    }

    //Address is cached from a previous result
    if (_this.cache[row[_this.options.address]]) {

      row[_this.options.lat] = _this.cache[row[_this.options.address]].lat;
      row[_this.options.lng] = _this.cache[row[_this.options.address]].lng;

      _this.emit("row",null,row);
      return cb(null,row);

    }

    request.get(misc.url(_this.options.url,row[_this.options.address]),function(err,response,body) {
    
      //Some other error
      if (err) {

        _this.emit("row",err.toString(),row);
        return cb(null,row);

      } else if (response.statusCode !== 200) {

        _this.emit("row","HTTP Status "+response.statusCode,row);
        return cb(null,row);

      } else {

        handleResponse(body,row,cb);

      }

    });

  }


  function handleResponse(body,row,cb) {

    var result;

    try {
      result = _this.options.handler(body,row[_this.options.address]);
    } catch(e) {
      _this.emit("row","Parsing error: "+e.toString(),row);
    }

    //Error code
    if (typeof result === "string") {

      row[_this.options.lat] = "";
      row[_this.options.lng] = "";

      _this.emit("row",result,row);

    //Success
    } else if ("lat" in result && "lng" in result) {

      row[_this.options.lat] = result.lat;
      row[_this.options.lng] = result.lng;

      //Cache the result
      _this.cache[row[_this.options.address]] = result;
      _this.emit("row",null,row);

    //Unknown extraction error
    } else {

      _this.emit("row","Invalid return value from handler for response body: "+body,row);

    }

    return setTimeout(function(){
      cb(null,row);
    },_this.options.delay);

  }


  function complete(err,results) {

    if (!_this.options.test) {
      csv.stringify(data,{ header: true },function(e,stringified){
        //write to a file
        console.log("WOULD WRITE TO A FILE");
        summary(results);
      });
    } else {
      summary(results);
    }

  }

  function successful(row) {
    return misc.isNumeric(row[_this.options.lat]) && misc.isNumeric(row[_this.options.lng]);
  }

  function summary(results) {

    var successes = results.filter(successful).length;

    _this.emit("complete",{
      failures: results.length - successes,
      successes: successes,
      time: (new Date()).getTime() - _this.time
    });
  }

}

