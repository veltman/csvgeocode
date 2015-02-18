var fs = require("fs"),
    parse = require("csv-parse"),
    stringify = require("csv-stringify");

module.exports = {
  read: function(filename,cb) {
    fs.readFile(filename,"utf8",function(err,raw){

      if (err) {
        throw new Error(err);
      }

      _parse(raw,cb);

    });
  },
  write: function(filename,rows,cb) {
    _stringify(rows,function(string){
      fs.writeFile(filename,string,function(err){
        if (err) {
          throw new Error(err);
        };
        cb();
      });
    });
  },
  parse: _parse,
  stringify: _stringify
};

function _parse(raw,cb) {

  parse(raw,{columns:true},function(err,parsed){
    if (err) {
      throw new Error(err);
    }

    cb(parsed);
  });

}

function _stringify(rows,cb) {

  stringify(rows,{header:true},function(err,string){
    if (err) {
      throw new Error(err);
    }

    cb(string);
  });

}