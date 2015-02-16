csvgeocode
==========

Bulk geocode addresses in a CSV with one or two lines of code.

The defaults are configured to use Google's geocoder but it can be configured to work with any other similar geocoding service.

## Basics: command line usage

Install globally via npm:

```
npm install -g csvgeocode
```

Use it:

```
$ csvgeocode path/to/input.csv path/to/output.csv
```

## Basics: use as a node module

Install via `npm`:

```
npm install csvgeocode
````

Use it:

```js
var csvgeocode = require("csvgeocode");

//Write a new CSV with lat/lng columns added
csvgeocode("path/to/input.csv","path/to/output.csv");
```

## Details

You can specify an input CSV, an output CSV, and some options.  Only an input CSV is required.  If no output CSV is specified, the output will stream to stdout, so you could do something like:

```
$ csvgeocode input.csv | grep "greppin for somethin"
```

You can supply options to the command line version with `--option-name value` or in a script using a hash of options.

From the command line:

```
$ csvgeocode input.csv output.csv --delay 1000 --address MY_ADDRESS_COLUMN_NAME
```

In a script:

```js
csvgeocode("input.csv","output.csv",{
   address: "MY_ADDRESS_COLUMN_NAME",
   delay: 1000
});
```

## Options

The following options are available.  NONE ARE REQUIRED.

#### `address`

The name of the column that contains the address to geocode.  This column must exist in the input CSV.

**Default:** Automatically detect if there's a relevant column name in the input CSV, like `address` or `street_address`.

```
$ csvgeocode input.csv output.csv --address MY_ADDRESS_COLUMN_HAS_THIS_DUMB_NAME
```

```js
csvgeocode("input.csv","output.csv",{
  address: "MY_ADDRESS_COLUMN_HAS_THIS_DUMB_NAME"
});
```

#### `lat`

The name of the column that should contain the resulting latitude.  If this column doesn't exist in the input CSV, it will be created in the output.

**Default:** Automatically detects if there is a relevant column name in the input CSV, like `lat` or `latitude`.  If none is found, it will add the new column `lat` to the output.

```
$ csvgeocode input.csv output.csv --lat MY_EXISTING_LATITUDE_COLUMN
```

```
$ csvgeocode input.csv output.csv --lat THIS_COLUMN_DOES_NOT_EXIST_YET_BUT_WILL_BE_CREATED
```

```js
csvgeocode("input.csv","output.csv",{
  lat: "MY_LATITUDE_COLUMN_NAME"
});
```

#### `lng`

The name of the column that should contain the resulting longitude.  If this column doesn't exist in the input CSV, it will be created in the output.

**Default:** Automatically detects if there is a relevant column name in the input CSV, like `lng` or `longitude`.  If none is found, it will add the new column `lng` to the output.

```
$ csvgeocode input.csv output.csv --lng MY_EXISTING_LONGITUDE_COLUMN
```

```
$ csvgeocode input.csv output.csv --lat THIS_COLUMN_DOES_NOT_EXIST_YET_BUT_WILL_BE_CREATED
```

```js
csvgeocode("input.csv","output.csv",{
  lng: "MY_LONGITUDE_COLUMN_NAME"
});
```

#### `delay`

The number of milliseconds to wait between geocoding calls.  Setting this to 0 is probably a bad idea because most geocoders limit how fast you can make requests.

```
$ csvgeocode input.csv output.csv --delay 500
```

```js
csvgeocode("input.csv","output.csv",{
  delay: 500
});
```

#### `force`

By default, if a lat/lng is already found in an input row, that will be preserved.  Set `force` if you want to re-geocode every row even if an existing lat/lng is detected.  Forcing means you'll hit API limits faster and the process will take longer.

**Default:** `false`

```
$ csvgeocode input.csv output.csv --force
```

```js
csvgeocode("input.csv","output.csv",{
  force: true
});
```

#### `url`

The URL template to use for geocoding.  The placeholder `{{a}}` will be replaced by each individual address.  You might want to use this to add extra arguments to a Google geocoding request, like bounds.  If you want to use a different geocoder entirely, you should only use it in a script (see "Using a different geocoder" below).

**Default:** `https://maps.googleapis.com/maps/api/geocode/json?address={{a}}`

```
$ csvgeocode input.csv -output.csv --url "https://maps.googleapis.com/maps/api/geocode/json?bounds=40,-74|41,-72&address={{a}}"
```

#### `handler`

What handler function to return a lat/lng from the geocoding response body.  Acceptable values are `"google"` or a custom handler function for a geocoding API response.

A custom handler function will get two arguments: the response body and the address being geocoded.  It should return an object with `lat` and `lng` properties when successful.  Otherwise it should return a string error message.  For details, see "Using a different geocoder" below.

**Default:** "google"

## Using a different geocoder

To use a geocoding API besides Google's, you need to use csvgeocode and supply custom `url` and `handler` options.  For example, if you wanted to use the Mapbox geocoder, you would do something like:

```js
csvgeocode("input.csv","output.csv",{
  url: "http://api.tiles.mapbox.com/v4/geocode/mapbox.places/{{a}}.json?access_token=MY_API_KEY",
  handler: mapboxHandler
});

function mapboxHandler(body,address) {

  var result = JSON.parse(body);

  //Error, return a string
  if (result.features === undefined) {

    return "[ERROR] "+response.message;

  //No results, return a string
  } else if (!ressult.features.length) {

    return "[NO MATCH] "+address;

  }

  //Success, return a lat/lng object
  return {
    lat: result.features[0].center[1],
    lng: result.features[0].center[0]
  };

}

```

## Events

If you're using csvgeocode as a module in a script, you can listen for three three events: `success`, `failure` and `complete`.

`success` is emitted whenever a row in the input CSV successfully geocodes.

`failure` is emitted whenever a row in the input CSV fails to geocode.

`complete` is emitted when all rows are done, and includes a summary object with `failures`, `successes`, and `time` properties.

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

* Add the NYC geocoder as a built-in handler.
* Support a CSV with no header row where `lat`, `lng`, and `address` are numerical indices instead of column names.
* Make `bounds` a separate option rather than something you have to hardcore into the URL.
* Support the `handler` option for CLI too.
* Support both POST and GET requests somehow.

## Credits/License

By [Noah Veltman](https://twitter.com/veltman)

Available under the MIT license.

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions.

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.