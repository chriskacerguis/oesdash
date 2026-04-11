const axios = require('axios');
const config = require('../config');
const { cached } = require('../cache');

const LAT = config.stationLat;
const LON = config.stationLon;
const AIRNOW_KEY = config.airnowApiKey;

const list = cached('airnow_aqi', 600_000, async () => {
  if (!AIRNOW_KEY) {
    return { aqi: null, category: 'Unknown', error: { message: 'AIRNOW_API_KEY not configured' } };
  }
  const { data } = await axios.get(
    'https://www.airnowapi.org/aq/observation/latLong/current/',
    {
      timeout: 10000,
      params: {
        format: 'application/json',
        latitude: LAT,
        longitude: LON,
        distance: 25,
        API_KEY: AIRNOW_KEY,
      },
    }
  );
  return data.map(d => ({
    parameter: d.ParameterName,
    aqi: d.AQI,
    category: d.Category.Name,
    dateObserved: d.DateObserved,
    reportingArea: d.ReportingArea,
  }));
});

module.exports = { list };
