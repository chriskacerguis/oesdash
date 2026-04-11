const axios = require('axios');
const config = require('./config');

const nwsHeaders = { 'User-Agent': 'OES-Dashboard/1.0 (emergency-ops@localhost)', Accept: 'application/geo+json' };

let nwsPointCache = null;

async function getNwsPoint() {
  if (nwsPointCache) return nwsPointCache;
  const { data } = await axios.get(
    `https://api.weather.gov/points/${config.stationLat},${config.stationLon}`,
    { headers: nwsHeaders, timeout: 10000 }
  );
  const props = data.properties;
  const zones = new Set();
  for (const url of [props.forecastZone, props.county, props.fireWeatherZone]) {
    if (url) {
      const id = url.split('/').pop();
      if (id) zones.add(id);
    }
  }
  nwsPointCache = {
    office: props.gridId,
    gridX: props.gridX,
    gridY: props.gridY,
    zones: [...zones],
  };
  return nwsPointCache;
}

module.exports = { nwsHeaders, getNwsPoint };
