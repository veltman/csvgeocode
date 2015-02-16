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

  //TO DO: allow more concurrency?
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
      if (this.options.lat === null || this.options.lng === null || this.options.address === null) {

        this.options = misc.discoverOptions(this.options,row);

        if (this.options.address === null) {
          throw new Error("Couldn't auto-detect address column.");
        }

      }

      this.queue.defer(this.codeRow.bind(this),row);


    }.bind(this))
    .on("end",function(){
      this.queue.awaitAll(this.complete.bind(this));
    }.bind(this));

  return this;

}

Geocoder.prototype.codeRow = function(row,cb) {

  var cbgb = function(){
    return cb(null,!!(row.lat && row.lng));
  };

  if (row[this.options.address] === undefined) {
    this.emit("failure","[ERROR] Couldn't find address column '"+this.options.address+"'");
    return this.formatter.write(row,cbgb);
  }

  //Doesn't need geocoding
  if (!this.options.force && misc.isNumeric(row[this.options.lat]) && misc.isNumeric(row[this.options.lng])) {
    this.emit("success",row[this.options.address]);
    return this.formatter.write(row,cbgb);
  }

  //Address is cached from a previous result
  if (this.cache[row[this.options.address]]) {

    row[this.options.lat] = this.cache[row[this.options.address]].lat;
    row[this.options.lng] = this.cache[row[this.options.address]].lng;

    this.emit("success",row[this.options.address]);
    return this.formatter.write(row,cbgb);

  }

  request.get(misc.url(this.options.url,row[this.options.address]),function(err,response,body){

    var result;

    //Some other error
    if (err) {

      this.emit("failure","[ERROR]"+err.toString());

    } else if (response.statusCode !== 200) {

      this.emit("failure","[ERROR] HTTP Status "+response.statusCode);

    } else {

      try {
        result = this.options.handler(body,row[this.options.address]);
      } catch(e) {
        this.emit("failure","[ERROR] Parsing error: "+e.toString());
      }

      //Error code
      if (typeof result === "string") {

        row[this.options.lat] = "";
        row[this.options.lng] = "";

        this.emit("failure",result);

      //Success
      } else if ("lat" in result && "lng" in result) {

        row[this.options.lat] = result.lat;
        row[this.options.lng] = result.lng;

        //Cache the result
        this.cache[row[this.options.address]] = result;
        this.emit("success",row[this.options.address]);

      //Unknown extraction error
      } else {

        this.emit("failure","[ERROR] Invalid return value from handler for response body: "+body);

      }

    }

    return this.formatter.write(row,function(){
      setTimeout(cbgb,this.options.delay);
    }.bind(this));

  }.bind(this));

};

Geocoder.prototype.complete = function(err,results){
  var failures = results.filter(function(d){
    return !d;
  }).length;

  this.emit("complete",{
    failures: failures,
    successes: results.length - failures,
    time: (new Date()).getTime() - this.time
  });

}