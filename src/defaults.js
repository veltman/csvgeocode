module.exports =  {
  url: "https://maps.googleapis.com/maps/api/geocode/json?address={{a}}",
  lat: null,
  lng: null,
  address: null,
  delay: 250,
  force: false,
  handler: function(body,address) {

    var response = JSON.parse(body);


    //Success, return a lat/lng object
    if (response.results && response.results.length) {
      return response.results[0].geometry.location;
    }

    //No match, return a string
    if (response.status === "ZERO_RESULTS" || response.status === "OK") {
      return "[NO MATCH] "+address;
    }

    //Other error, return a string
    return "[ERROR] "+response.status;

  }
};