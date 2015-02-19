var fs = require("fs"),
    csv = require("dsv")(",");

module.exports = {
  read: function(filename,cb) {
    fs.readFile(filename,"utf8",function(err,raw){

      if (err) {
        throw new Error(err);
      }

      cb(csv.parse(raw));

    });
  },
  write: function(filename,rows,cb) {
    fs.writeFile(filename,csv.format(rows),function(err){
      if (err) {
        throw new Error(err);
      };
      cb();
    });
  },
  parse: csv.parse,
  stringify: csv.format
};