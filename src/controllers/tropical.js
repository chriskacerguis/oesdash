const axios = require('axios');
const { cached } = require('../cache');
const { nwsHeaders, getNwsPoint } = require('../nws');

const list = cached('nhc_tropical', 600_000, async () => {
  try {
    const { data } = await axios.get(
      'https://www.nhc.noaa.gov/CurrentSummary.json',
      { timeout: 10000, headers: { Accept: 'application/json' } }
    );
    return data;
  } catch {
    try {
      const { data } = await axios.get(
        'https://www.nhc.noaa.gov/gis/forecast/archive/active_forecast.json',
        { timeout: 10000 }
      );
      return data;
    } catch {
      const { zones } = await getNwsPoint();
      const { data } = await axios.get(
        `https://api.weather.gov/alerts/active?zone=${zones.join(',')}&event=Tropical%20Storm%20Warning,Hurricane%20Warning,Tropical%20Storm%20Watch,Hurricane%20Watch`,
        { timeout: 10000, headers: nwsHeaders }
      );
      return {
        activeStorms: data.features.length > 0,
        alerts: data.features.map(f => ({
          event: f.properties.event,
          headline: f.properties.headline,
          severity: f.properties.severity,
          areas: f.properties.areaDesc,
        })).slice(0, 5),
        nhcUrl: 'https://www.nhc.noaa.gov/',
      };
    }
  }
});

module.exports = { list };
