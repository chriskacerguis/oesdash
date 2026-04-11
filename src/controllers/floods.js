const axios = require('axios');
const config = require('../config');
const { cached } = require('../cache');
const { distanceMiles } = require('../utils/geo');

const LAT = config.stationLat;
const LON = config.stationLon;
const FLOOD_RADIUS_MILES = 30;

const list = cached('atxfloods', 120_000, async () => {
  try {
    const { data } = await axios.get(
      'https://api.atxfloods.com/api/closures',
      { timeout: 10000, headers: { Accept: 'application/json' } }
    );
    const crossings = data.attributes || data;
    if (Array.isArray(crossings)) {
      return crossings
        .map(c => ({
          name: c.name,
          status: c.status || c.status_id,
          address: c.address,
          jurisdiction: c.jurisdiction,
          comment: c.comment,
          updatedAt: c.updated_at || c.updatedAt,
          lat: c.lat || c.latitude,
          lon: c.lon || c.longitude,
        }))
        .filter(c => {
          if (c.lat == null || c.lon == null) return false;
          return distanceMiles(LAT, LON, +c.lat, +c.lon) <= FLOOD_RADIUS_MILES;
        });
    }
    return crossings;
  } catch {
    return { crossings: [], error: { message: 'ATXFloods data unavailable — check https://www.atxfloods.com' } };
  }
});

module.exports = { list };
