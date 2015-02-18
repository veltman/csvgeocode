csvgeocode
==========

For when you have a CSV with addresses and you want a lat/lng for every row.  Bulk geocode addresses a CSV with one or two lines of code. 

The defaults are configured to use [Google's geocoder](https://developers.google.com/maps/documentation/geocoding/) but it can be configured to work with any other similar geocoding service.

## Basic command line usage

Install globally via npm:

```
npm install -g csvgeocode
```

Use it:

```
$ csvgeocode path/to/input.csv path/to/output.csv
```

If you don't specify an output file, the output will stream to stdout instead, so you can do something like:

```
$ csvgeocode path/to/input.csv | grep "greppin for somethin"
```

## Options

You can add extra options when running `csvgeocode`.  For example:

```
$ csvgeocode input.csv output.csv --address MY_ADDRESS_COLUMN_HAS_THIS_WEIRD_NAME --delay 1000 --verbose
```

None of the options are required.

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
$ csvgeocode input.csv output.csv --verbose
160 Varick St, New York NY: SUCCESS
1600 Pennsylvania Ave, Washington, DC: SUCCESS
123 Fictional St: NO MATCH

Rows geocoded: 2
Rows failed: 1
Time elapsed: 1.8 seconds
```

#### `url`

The URL template to use for geocoding.  The placeholder `{{a}}` will be replaced by each individual address.  You might want to use this to add extra arguments to a Google geocoding request, like bounds.  If you want to use a different geocoder entirely, you can do that by using `csvgeocode` as a Node module (see below).

**Default:** `https://maps.googleapis.com/maps/api/geocode/json?address={{a}}`

## Using as a Node module

Install via `npm`:

```
npm install csvgeocode
```

Use it:

```js
var csvgeocode = require("csvgeocode");

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
  "url": "https://maps.googleapis.com/maps/api/geocode/json?bounds=40,-74|41,-72&address={{a}}"
};

//write to a file
csvgeocode("input.csv","output.csv",options);

//stream to stdout
csvgeocode("input.csv",options);
```
`csvgeocode` runs asynchronously, but you can listen for two events: `row` and `complete`.

`row` is triggered when each row is processed. It passes a string error message if geocoding the row failed, and the row itself.

```js
csvgeocode("input.csv","output.csv")
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
csvgeocoder("input.csv","output.csv")
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

## Using a non-Google geocoder

You can use a non-Google geocoder from within a Node script by customizing the `url` option and adding a custom function as the `handler` option.

Your handler will be passed two string arguments: the body of the geocoder response and the address being geocoded.

It should return a string error message if there's no lat/lng to use, or it should return an object with `lat` and `lng` properties.

For example, if you wanted to use [Mapbox's geocoder](https://www.mapbox.com/developers/api/geocoding/) instead, you could run it like this:

```js
csvgeocode("input.csv","output.csv",{
  url: "http://api.tiles.mapbox.com/v4/geocode/mapbox.places/{{a}}.json?access_token=MY_API_KEY", //custom URL template
  handler: mapboxHandler //custom handler function
});

function mapboxHandler(body,address) {

  var result = JSON.parse(body);

  //Error, return a string
  if (result.features === undefined) {

    return response.message;

  //No results, return a string
  } else if (!result.features.length) {

    return "No match for " + address;

  }

  //Success, return a lat/lng object
  return {
    lat: result.features[0].center[1],
    lng: result.features[0].center[0]
  };

}
```

## Notes

Geocoding a long list of unsanitized addresses rarely goes perfectly the first time.  Using csvgeocode, any addresses that don't succeed will have their lat/lng columns left blank.  By listening for the `row` event or browsing the final results, you can figure out which ones failed and edit them as needed.  Then you can run the result back through and only the failed rows will get re-geocoded.

## To Do

* Add the NYC geocoder as a built-in handler.
* Support a CSV with no header row where `lat`, `lng`, and `address` are numerical indices instead of column names.
* Allow `address` to be an array of multiple fields that get concatenated (e.g. `["street","city","state","zip"]`)
* Make `bounds` a separate option rather than something you have to hardcore into the URL.
* Support the `handler` option for CLI too?
* Support both POST and GET requests somehow.

## Credits/License

By [Noah Veltman](https://twitter.com/veltman)

Available under the MIT license.

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions.

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.