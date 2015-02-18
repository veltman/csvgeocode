csvgeocode
==========

For when you have a CSV with addresses and you want a lat/lng for every row.  Bulk geocode addresses a CSV with a few lines of code. 

The defaults are configured to use [Google's geocoder](https://developers.google.com/maps/documentation/geocoding/) but it can be configured to work with any other similar geocoding service.  Make sure that you use this in compliance with the relevant API's terms of service (Google's terms are [here](https://developers.google.com/maps/terms) and require any geocoding to be in conjunction with display on a Google Map).

## Basic command line usage

Install globally via npm:

```
npm install -g csvgeocode
```

Use it:

```
$ csvgeocode path/to/input.csv path/to/output.csv
```

If you don't specify an output file, the output will stream to stdout instead, so you can stream the result as an HTTP response or do something like:

```
$ csvgeocode path/to/input.csv | grep "greppin for somethin"
```

## Options

You can add extra options when running `csvgeocode`.  For example:

```
$ csvgeocode input.csv output.csv --address MY_ADDRESS_COLUMN_HAS_THIS_WEIRD_NAME --delay 1000 --verbose
```

None of the options are required.

#### `--handler [handler]`

What API handler to use. Current built-in handlers are "google" and "mapbox". Contributions of handlers for other geocoders welcome! You can define a custom handler when using this as a Node module (see below).

**Default:** `"google"`

#### `--key [key]`

The API key to use with requests.

**Default:** none

#### `--address [address column name]`

The name of the column that contains the address to geocode.

**Default:** Tries to automatically detect if there's a relevant column name in the input CSV, like `address` or `street_address`.

#### `--lat [latitude column name]`

The name of the column that should contain the resulting latitude.  If this column doesn't exist in the input CSV, it will be created in the output.

**Default:** Tries to automatically detect if there is a relevant column name in the input CSV, like `lat` or `latitude`.  If none is found, it will add the new column `lat` to the output.

#### `--lng [longitude column name]`

The name of the column that should contain the resulting longitude.  If this column doesn't exist in the input CSV, it will be created in the output.

**Default:** Tries to automatically detect if there is a relevant column name in the input CSV, like `lng` or `longitude`.  If none is found, it will add the new column `lng` to the output.

#### `--delay [milliseconds]`

The number of milliseconds to wait between geocoding calls.  Setting this to 0 is probably a bad idea because most geocoders limit how fast you can make requests.

**Default:** 250

#### `--force`

By default, if a lat/lng is already found in an input row, that will be kept.  If you want to re-geocode every row no matter what and replace any lat/lngs that already exist, add `--force`.  This means you'll hit API limits faster and the process will take longer.

#### `--verbose`

See extra output while csvgeocode is running.

```
$ csvgeocode input.csv --verbose
...
160 Varick St, New York NY: SUCCESS
1600 Pennsylvania Ave, Washington, DC: SUCCESS
123 Fictional St: NO MATCH

Rows geocoded: 2
Rows failed: 1
Time elapsed: 1.8 seconds
```

## Using as a Node module

Install via `npm`:

```
npm install csvgeocode
```

Use it:

```js
var csvgeocode = require("csvgeocode");

//stream to stdout
csvgeocode("path/to/input.csv");

//write to a file
csvgeocode("path/to/input.csv","path/to/output.csv");
```

You can add all the same options in a script, except for `verbose`.

```js
var options = {
  "address": "MY_SPECIAL_ADDRESS_COLUMN_NAME",
  "lat": "MY_SPECIAL_LATITUDE_COLUMN_NAME",
  "lng": "MY_SPECIAL_LONGITUDE_COLUMN_NAME",
  "delay": 1000,
  "force": true,
  "handler": "mapbox"
};

//stream to stdout
csvgeocode("input.csv",options);

//write to a file
csvgeocode("input.csv","output.csv",options);
```

`csvgeocode` runs asynchronously, but you can listen for two events: `row` and `complete`.

`row` is triggered when each row is processed. It passes a string error message if geocoding the row failed, and the row itself.

```js
csvgeocode("input.csv")
  .on("row",function(err,row){
    if (err) {
      console.warn(err);
    }
    /*
      `row` is an object like:
      {
        first: "John",
        last: "Keefe",
        address: "160 Varick St, New York NY",
        employer: "WNYC",
        lat: 40.7267926,
        lng: -74.00537369999999
      }
    */
  });
```

`complete` is triggered when all geocoding is done.  It passes a `summary` object with three properties: `failures`, `successes`, and `time`.

```js
csvgeocoder("input.csv")
  .on("complete",function(summary){
    /*
      `summary` is an object like:
      {
        failures: 1, //1 row failed
        successes: 49, //49 rows succeeded
        time: 8700 //it took 8.7 seconds
      }
    */
  });
```

## Using a custom geocoder

You can use any basic geocoding service from within a Node script by supplying a custom handler.

The easiest way to see what a handler should look like is to look at [handlers.js](./src/handlers.js).

A handler needs a `url` function and a `process` function, like:

```js
var customHandler = {
  url: function(address,options) {
    return "http://mygeocoder.com/?address="+encodeURIComponent(address)+"&api_key="+options.key;
  },
  process: function(body) {
    if (body.results) {
      return body.results[0];
    } else {
      return "NO MATCH";
    }
  }
}

```

The `url` function will get passed the address being geocoded and the current options and should return the URL to request for that address.

The `process` function will be passed the body of the geocoder response. It should return a string error message if there's no lat/lng to use, or it should return an object with `lat` and `lng` properties.

## Some Alternatives

* [file-geocoder](https://www.npmjs.com/package/file-geocoder)
* [Texas A & M Batch Geocoder](http://geoservices.tamu.edu/Services/Geocode/BatchProcess/)
* [batchgeo](https://en.batchgeo.com/)

## To Do

* Add the NYC and TAMU geocoders as built-in handlers.
* Support a CSV with no header row where `lat`, `lng`, and `address` are numerical indices instead of column names.
* Allow `address` to be an array of multiple fields that get concatenated (e.g. `["street","city","state","zip"]`)
* Support the `handler` option for CLI too?
* Support both POST and GET requests somehow.

## Credits/License

By [Noah Veltman](https://twitter.com/veltman)

Available under the MIT license.

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions.

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.