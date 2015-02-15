Geode
=====

Bulk geocode addresses in a CSV with one line of code (OK, two lines of code).

The defaults are configured to use Google's geocoder but can be configured to work with any other similar geocoding service.

## Installation

Install via `npm`:

```
npm install geode
````

## Basic Usage

```js
var geode = require("geode");

//Write a new CSV with lat/lng columns added
geode("path/to/input.csv","path/to/output.csv");
```

## A Little More

### geode(input,output,options)

You must specify an `input` filename as the first argument.

You can optionally specify an `output` filename to write the results to a new CSV.  If you don't specify one, the results will be streamed to `stdout`.

You can specify `options` to override the defaults (see below).

```js

//Write to a file with default options
geode("input.csv","output.csv");

//Write to a file with some custom options
geode("input.csv","output.csv",{
   addressColumn: "MY_ADDRESS_COLUMN"
});

//Stream to stdout with default options
geode("input.csv");

//Stream to stdout with some custom options
geode("input.csv",{
  headerRow: false
});

```

## Options

The following options are available:

#### `url`

The URL template to use for geocoding.  The placeholder `{{a}}` will be replaced by each individual address.

**Default:** `https://maps.googleapis.com/maps/api/geocode/json?address={{a}}`

**Default:** `true`

#### `addressColumn`

The name of the column that contains the address to geocode.  This must exist in the CSV.

**Default:** Automatically detects if there is a relevant column name like `address` or `street_address`.

#### `latColumn`

The name of the column that should contain the resulting latitude.  If this column doesn't exist in the input CSV, it will be created in the output.

**Default:** Automatically detects if there is a relevant column name like `lat` or `latitude`.  If none exists, uses `lat`.

#### `lngColumn`

The name of the column that should contain the resulting longitude.  If this column doesn't exist in the input CSV, it will be created in the output.

**Default:** Automatically detects if there is a relevant column name like `lng` or `longitude`.  If none exists, uses `lng`.

#### `timeout`

The number of milliseconds to wait between geocoding calls.  Setting this to 0 may result in most calls failing because of API throttling.  Space your requests out a little.  Let 'em breathe.

**Default:** `250`

#### `handler`

A function that takes the entire body of a geocoding service response and return either a string error message if there was an error, or an object with `lat` and `lng` properties if it was successful.

**Default:** The default `handler` function is written to handle Google Geocoding API responses:

```js

function googleHandler(body) {

  var response = JSON.parse(body);

  //Error code, return a string
  if (response.status !== "OK") {
    return response.status;
  }

  //No results, return the string "NO MATCH"
  if (!response.results || !response.results.length) {
    return "NO MATCH";
  }

  //Success, return a lat/lng object
  return response.results[0].geometry.location;

}

```

#### `force`

Set to `true` if you want to re-geocode every row even if an existing lat/lng is detected.

**Default:** `false`

## Events

While the geocoder is running, it will emit two events: `err` and `end`.

`err` is emitted whenever a row in the input CSV fails to geocode.

`end` is emitted when all rows are done, and includes a summary object with `failures`, `successes`, and `time` properties.

```js
geocoder("input.csv","output.csv")
  .on("err",function(err){
    //Triggered every time a row fails to geocode
    console.warn(err);
  })
  .on("end",function(summary){
    console.log(summary);
  });

/*
NO MATCH FOR 123 FICTIONAL STREET
NO MATCH FOR 99 MISFORMATTED ADDRESS, USA
{
  'failures': 2, //2 rows failed
  'successes': 80 //80 rows succeeded,
  'time': '15.4s' //took 15.4 seconds
}
*/

```

## Using a different geocoder

The default values for `url` and `handler` are configured to work with Google's Geocoding API.  To use a different geocoding service, supply different values for those two options.  For example, if you want to use Mapbox's geocoding API:

```js
geocode("input.csv","output.csv",{
  "url": "http://api.tiles.mapbox.com/v4/geocode/mapbox.places/{{a}}.json?access_token=MY_API_KEY",
  "handler": mapboxHandler
});

function mapboxHandler(body) {

  var response = JSON.parse(body);

  //Error, return a string
  if (response.features === undefined) {
    return response.message;
  } else if (!response.features.length) {
    return "NO MATCH";
  }

  //Success, return a lat/lng object
  return {
    lat: response.features[0].center[1],
    lng: response.features[0].center[0]
  };

}
```

## Notes

Geocoding a long list of unsanitized addresses rarely goes perfectly the first time.  Using this module, any addresses that don't succeed will have their lat/lng columns left blank.  If you set `verbose: true` you can get a full list of failed addresses at the end.

## To Do

* Fix the `verbose` option to also give you a summary report (this is currently broken for async reasons).
* Currently pauses/resumes the stream to enforce delays between geocoding calls. There is probably a smarter way to queue/throttle those.
* Support a CSV with no header row where `latColumn`, `lngColumn`, and `addressColumn` are numerical indices instead of column names.
* Make `bounds` a separate option rather than something you have to hardcore into the URL.
* Support non-Google geocoders with the option of a custom `processor` function.
* Support both POST and GET requests somehow.

## Credits/License

By [Noah Veltman](https://twitter.com/veltman)

Available under the MIT license.

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions.

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.