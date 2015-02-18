var misc = require("./misc"),
    defaults = require("./defaults"),
    handlers = require("./handlers"),
    fs = require("fs"),
    request = require("request"),
    queue = require("queue-async"),
    extend = require("extend"),
    util = require("util"),
    csv = require("./csv"),
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

  //Extend default options
  options = extend({},defaults,options);

  if (typeof options.handler === "string") {
    options.handler = options.handler.toLowerCase();
    if (handlers[options.handler]) {
      options.handler = handlers[options.handler];
    } else {
      throw new Error("Invalid value for 'handler' option.  Must be the name of a built-in handler or a custom handler.");
    }
  } else if (typeof options.handler.process !== "function" || typeof options.handler.url !== "function") {
    throw new TypeError("Invalid value for 'handler' option.  Must be the name of a built-in handler or a custom handler.");
  }

  if (output && typeof output !== "string") {
    throw new TypeError("Invalid value for output.  Needs to be a string filename.");
  }

  var geocoder = new Geocoder();

  return geocoder.run(input,output,options);

};

var Geocoder = function() {
};

util.inherits(Geocoder, EventEmitter);

Geocoder.prototype.run = function(input,output,options) {

  var cache = {}, //Cached results by address
      _this = this,
      time = (new Date()).getTime();

  this.options = options;

  csv.read(input,csvParsed);

  return this;

  function csvParsed(parsed) {

    var q = queue(1);

    //If there are unset column names,
    //try to discover them on the first data row
    if (options.lat === null || options.lng === null || options.address === null) {

      options = misc.discoverOptions(options,parsed[0]);

      if (options.address === null) {
        throw new Error("Couldn't auto-detect address column.");
      }

    }

    parsed.forEach(function(row){
      q.defer(codeRow,row);
    });

    q.awaitAll(complete);

  }

  function codeRow(row,cb) {

    if (row[options.address] === undefined) {
      throw new Error("Couldn't find address column '"+options.address+"'");
    }

    //Doesn't need geocoding
    if (!options.force && misc.isNumeric(row[options.lat]) && misc.isNumeric(row[options.lng])) {
      _this.emit("row",null,row);
      return cb(null,row);
    }

    //Address is cached from a previous result
    if (cache[row[options.address]]) {

      row[options.lat] = cache[row[options.address]].lat;
      row[options.lng] = cache[row[options.address]].lng;

      _this.emit("row",null,row);
      return cb(null,row);

    }

    request.get(misc.url(options,row[options.address]),function(err,response,body) {
    
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
      result = options.handler.process(body,row[options.address]);
    } catch (e) {
      _this.emit("row","Parsing error: "+e.toString(),row);
    }

    //Error code
    if (typeof result === "string") {

      row[options.lat] = "";
      row[options.lng] = "";

      _this.emit("row",result,row);

    //Success
    } else if ("lat" in result && "lng" in result) {

      row[options.lat] = result.lat;
      row[options.lng] = result.lng;

      //Cache the result
      cache[row[options.address]] = result;
      _this.emit("row",null,row);

    //Unknown extraction error
    } else {

      _this.emit("row","Invalid return value from handler for response body: "+body,row);

    }

    return setTimeout(function(){
      cb(null,row);
    },options.delay);

  }


  function complete(e,results) {

    var numSuccesses = results.filter(successful).length,
        numFailures = results.length - numSuccesses,
        summarize = function(){
          _this.emit("complete",{
            failures: numFailures,
            successes: numSuccesses,
            time: (new Date()).getTime() - time
          });
        };

    if (!options.test) {

      if (typeof output === "string") {

        csv.write(output,results,summarize);

      } else {

        output = output || process.stdout;

        csv.stringify(results,function(string){

          try {

            output.write(string,summarize);

          } catch(e) {

            throw new TypeError("Second argument output needs to be a filename or a writeable stream.");

          }

        });

      }

    } else {
      summarize();
    }

  }

  function successful(row) {
    return misc.isNumeric(row[options.lat]) && misc.isNumeric(row[options.lng]);
  }

};

