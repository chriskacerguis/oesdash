const config = require('../config');
const { reverseGeocode } = require('../services/geocode');

const LAT = config.stationLat;
const LON = config.stationLon;

let resolvedLocation = null;

async function get(_req, res) {
  if (!resolvedLocation) {
    try {
      resolvedLocation = await reverseGeocode(LAT, LON);
    } catch {
      resolvedLocation = null;
    }
  }
  res.json({ lat: LAT, lon: LON, location: resolvedLocation });
}

module.exports = { get };
