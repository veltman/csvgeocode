module.exports = {
  google: {
    url: function(address,key) {
      address = address.replace(/ /g,"+").replace(/[&]/g,"%26");
      key = key || "";
      return "https://maps.googleapis.com/maps/api/geocode/json?address="+address+(key ? "&key="+key : "");
    },
    process: function(body,address) {

      var response = JSON.parse(body);

      //Success, return a lat/lng object
      if (response.results && response.results.length) {
        return response.results[0].geometry.location;
      }

      //No match, return a string
      if (response.status === "ZERO_RESULTS" || response.status === "OK") {
        return "NO MATCH";
      }

      //Other error, return a string
      return response.status;

    }
  },
  mapbox: {
      url: function(address,key){
        address = address.replace(/ /g,"+").replace(/[&]/g,"%26");
        key = key || "";
        return "http://api.tiles.mapbox.com/v4/geocode/mapbox.places/"+address+".json?access_token="+key;
      },
      process: function(body,address) {

      var response = JSON.parse(body);

      if (response.features === undefined) {
        return response.message;
      } else if (!response.features.length) {
        return "NO MATCH";
      }

      return {
        lat: response.features[0].center[1],
        lng: response.features[0].center[0]
      };

      }
  }
};