var assert = require("assert"),
    geocode = require("../"),
    queue = require("queue-async");

queue(1)
  .defer(basicTest)
  .defer(cacheTest)
  .defer(columnNamesTest)
  .defer(addColumnsTest)
  .defer(handlerTest)
  .defer(mapboxTest)
  .defer(throwTest)
  .awaitAll(function(){});

function basicTest(cb) {
  geocode("test/basic.csv",{
      test: true,
      url: process.env.TEST_URL
    })
    .on("row",function(err,row){
      assert("address" in row && 
        "lat" in row && "lng" in row,"address, lat, or lng missing from row");
      if (row.address === "160 Varick St, New York NY") {
        assert.deepEqual(Math.round(+row.lat),41,"Unexpected lat for "+row.address);
        assert.deepEqual(Math.round(+row.lng),-74,"Unexpected lng for "+row.address);
      } else if (row.address === "CACHED GIBBERISH ADDRESS") {
        assert.deepEqual(+row.lat,99,"Expected cached lat of 99.");
        assert.deepEqual(+row.lng,99,"Expected cached lng of 99.");
      }

      if (row.address === "THIS IS NOT AN ADDRESS") {
        assert(err,"NO MATCH","Expected NO MATCH for "+row.address);
      } else {
        assert.deepEqual(err,null,"Expected null error for "+row.address);
      }

    })
    .on("complete",function(summary){
      assert.deepEqual(summary.failures,1,"Expected 1 failure");
      assert.deepEqual(summary.successes,6,"Expected 6 successes");
      cb(null);
    });
}

function cacheTest(cb) {
  geocode("test/basic.csv",{
      force: true,
      test: true,
      url: process.env.TEST_URL
    })
    .on("row",function(err,row){
      if (row.address === "CACHED GIBBERISH ADDRESS") {
        assert.deepEqual(row.lat,"","Lat should be empty.");
        assert.deepEqual(row.lng,"","Lng should be empty.");
        assert.deepEqual(err,"NO MATCH","Expected NO MATCH for "+row.address);
      }
    })
    .on("complete",function(summary){
      assert.deepEqual(summary.failures,3,"Expected 3 failures");
      assert.deepEqual(summary.successes,4,"Expected 4 successes");
      cb(null);
    });
}

function columnNamesTest(cb) {
  geocode("test/column-names.csv",{
      lat: "LERTITUDE",
      lng: "LANGITUDE",
      test: true,
      url: process.env.TEST_URL
    })
    .on("row",function(err,row){
      assert.deepEqual(row.lat,undefined);
      assert.deepEqual(row.lng,undefined);
      if (err) {
        assert.deepEqual(row.LERTITUDE,"","Expected blank LERTITUDE in column names test.");
        assert.deepEqual(row.LANGITUDE,"","Expected blank LANGITUDE in column names test.");
        assert.deepEqual(err,"NO MATCH","Expected NO MATCH in column names test.");
      } else {
        assert(row.LERTITUDE && row.LANGITUDE,"LERTITUDE and LANGITUDE should be set in column names test.");
      }
    })
    .on("complete",function(summary){
      cb(null);
    });
}

function addColumnsTest(cb) {
  geocode("test/column-names.csv",{
      test: true,
      url: process.env.TEST_URL
    })
    .on("row",function(err,row){
      if (err) {
        assert.deepEqual(err,"NO MATCH","Expected NO MATCH in add columns test.");
      } else {
        assert("lat" in row && "lng" in row);
      }
    })
    .on("complete",function(summary){
      cb(null);
    });
}

function handlerTest(cb) {
  geocode("test/basic.csv",{
      force: true,
      url: process.env.TEST_URL,
      handler: function(body) {
          return "CUSTOM ERROR";
      },
      test: true
    })
    .on("row",function(err,row){
      assert.deepEqual(err,"CUSTOM ERROR","Expected CUSTOM ERROR from custom handler.");
    })
    .on("complete",function(summary){
      assert.deepEqual(summary.successes,0,"Expected 0 successes");
      cb(null);
    });
}

function throwTest(cb) {

  assert.throws(
    function(){
      geocode("test/basic.csv",{
        test: true,
        url: process.env.TEST_URL,
        handler: "dumb string"
      });
    },
    function(err) {
      if (err instanceof Error && /invalid value/i.test(err)) {
        return true;
      }
    },
    "Expected invalid handler message"
  );

  cb(null);

}

function mapboxTest(cb) {

  geocode("test/basic.csv",{
      handler: "mapbox",
      url: process.env.MAPBOX_TEST_URL,
      test: true
    })
    .on("row",function(err,row){
      if (err) {
        assert.deepEqual(err,"NO MATCH","Expected NO MATCH from mapboxHandler.");
      } else {
        assert(row.lat && row.lng);
      }
    })
    .on("complete",function(summary){
      assert.notDeepEqual(summary.successes,0,"Expected at least one success from Mapbox");
      cb(null);
    });

}