csvgeocode
==========

Bulk geocode addresses in a CSV with one line of code (OK, two lines of code).

The defaults are configured to use Google's geocoder but can be configured to work with any other similar geocoding service.

## Installation

Install via `npm`:

```
npm install csvgeocode
````

To use the command line version, install it globally:

```
npm install -g csvgeocode
```

## Basic Usage

In a script, use it like this:

```js
var csvgeocode = require("csvgeocode");

//Write a new CSV with lat/lng columns added
csvgeocode("path/to/input.csv","path/to/output.csv");
```

From the command line, use it like this:

```
$ csvgeocode path/to/input.csv path/to/output.csv
```

## A Little More

### csvgeocode(input[,output][,options])

You must specify an `input` filename as the first argument.

You can optionally specify an `output` filename to write the results to a new CSV.  If you don't specify one, the results will be streamed to `stdout`.

You can specify `options` to override the defaults (see below).

```js

//Write to a file with default options
csvgeocode("input.csv","output.csv");

//Write to a file with some custom options
csvgeocode("input.csv","output.csv",{
   address: "MY_ADDRESS_COLUMN_NAME"
});

//Stream to stdout with default options
csvgeocode("input.csv");

//Stream to stdout with some custom options
csvgeocode("input.csv",{
  delay: 500 //wait 500ms between geocoding calls
});

```

You can supply all the same options to the command line version:

```
$ csvgeocode path/to/input.csv path/to/output.csv --delay 500 --address MY_ADDRESS_COLUMN_NAME
```

## Options

The following options are available:

#### `url`

The URL template to use for geocoding.  The placeholder `{{a}}` will be replaced by each individual address.

**Default:** `https://maps.googleapis.com/maps/api/geocode/json?address={{a}}`

In a script:

```js
csvgeocode("input.csv","output.csv",{
  url: "http://myspecialgeocoder.com/?address={{a}}"
})
```

From the command line:

```
$ csvgeocode input.csv output.csv --url "http://myspecialgeocoder.com/?address={{a}}"
```

#### `address`

The name of the column that contains the address to geocode.  This must exist in the CSV.

**Default:** Automatically detects if there is a relevant column name like `address` or `street_address`.

In a script:

```js
csvgeocode("input.csv","output.csv",{
  address: "MY_ADDRESS_COLUMN_HAS_THIS_DUMB_NAME"
})
```

From the command line:

```
$ csvgeocode input.csv output.csv --address MY_ADDRESS_COLUMN_HAS_THIS_DUMB_NAME
```

#### `lat`

The name of the column that should contain the resulting latitude.  If this column doesn't exist in the input CSV, it will be created in the output.

**Default:** Automatically detects if there is a relevant column name like `lat` or `latitude`.  If none exists, uses `lat`.

In a script:

```js
csvgeocode("input.csv","output.csv",{
  lat: "MY_LATITUDE_COLUMN"
})
```

From the command line:

```
$ csvgeocode input.csv output.csv --lat MY_LATITUDE_COLUMN
```

#### `lng`

The name of the column that should contain the resulting longitude.  If this column doesn't exist in the input CSV, it will be created in the output.

**Default:** Automatically detects if there is a relevant column name like `lng` or `longitude`.  If none exists, uses `lng`.

In a script:

```js
csvgeocode("input.csv","output.csv",{
  lng: "MY_LONGITUDE_COLUMN"
})
```

From the command line:

```
$ csvgeocode input.csv output.csv --lng MY_LONGITUDE_COLUMN
```

#### `delay`

The number of milliseconds to wait between geocoding calls.  Setting this to 0 is probably a bad idea because most geocoders limit how fast you can make requests.

**Default:** `250`

In a script:

```js
csvgeocode("input.csv","output.csv",{
  delay: 1000
})
```

From the command line:

```
$ csvgeocode input.csv output.csv --delay 1000
```

#### `force`

Set to `true` if you want to re-geocode every row even if an existing lat/lng is detected.  Setting this to true means you'll hit API limits faster.

**Default:** `false`

In a script:

```js
csvgeocode("input.csv","output.csv",{
  force: true
})
```

From the command line:

```
$ csvgeocode input.csv output.csv --force
```

#### `handler`

Acceptable values are `"google"`, `"mapbox"`, or a custom handler function for a geocoding API response. A custom handler function will get two arguments: the response body and the address being geocoded.  It should return an object with `lat` and `lng` properties when successful.  Otherwise it should return a string error message, which will be passed to the `failure` event (see below).

**Default:** "google"

Writing your own could look something like this:

```js
csvgeocode("input.csv","output.csv",{
  url: "http://myspecialgeocoder.com?q={{a}}",
  handler: mySpecialHandler
});

function mySpecialHandler(body,address) {

  var parsed = JSON.parse(body);

  //Error, return a string
  if (parsed.error) {
    return "Some sort of error message.";
  }

  //No match, return a string
  if (parsed.results.length === 0) {
    return "No results for: "+address;
  }

  return {
    lat: parsed.results[0].lat,
    lng: parsed.results[0].lng
  };
}
```

## Events

While the geocoder is running, it will emit three events: `success`, `failure` and `complete`.

`success` is emitted whenever a row in the input CSV successfully geocodes.

`failure` is emitted whenever a row in the input CSV fails to geocode.

`complete` is emitted when all rows are done, and includes a summary object with `failures`, `successes`, and `time` properties.

You can listen to any of these events to monitor progress or trigger other events as needed.

```js
csvgeocoder("input.csv","output.csv")
  .on("failure",function(error){
    //An address failed, there's an error message
  })
  .on("success",function(address){
    //An address was successfully geocoded
  })
  .on("complete",function(summary){
    /*
    Summary is an object like:
    {
      failures: 1, //1 row failed
      successes: 49, //49 rows succeeded
      time: 8700 //it took 8.7 seconds
    }
    */
  });

```

## Notes

Geocoding a long list of unsanitized addresses rarely goes perfectly the first time.  Using csvgeocode, any addresses that don't succeed will have their lat/lng columns left blank.  By listening for the `failure` event (or just browsing the results), you can figure out which ones failed and edit them as needed.  Then you can run the result back through and only the failed rows will get re-geocoded.

## To Do

* Add the NYC geocoder and Mapbox as built-in handlers.
* Support a CSV with no header row where `latColumn`, `lngColumn`, and `addressColumn` are numerical indices instead of column names.
* Make `bounds` a separate option rather than something you have to hardcore into the URL.
* Support both POST and GET requests somehow.

## Credits/License

By [Noah Veltman](https://twitter.com/veltman)

Available under the MIT license.

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions.

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.