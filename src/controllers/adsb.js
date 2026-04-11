const axios = require('axios');
const config = require('../config');
const { cached } = require('../cache');

const ADSB_URL = config.adsbUrl;

const list = cached('adsb_aircraft', 10_000, async () => {
  try {
    let aircraft = [];
    let source = 'dump1090';
    try {
      const { data } = await axios.get(`${ADSB_URL}/flights.json`, { timeout: 5000 });
      if (data && typeof data === 'object' && !Array.isArray(data) && !data.aircraft) {
        source = 'fr24';
        aircraft = Object.entries(data).map(([hex, v]) => ({
          hex,
          flight: (Array.isArray(v) && v[16]) ? String(v[16]).trim() : '',
          lat: Array.isArray(v) ? v[1] || null : null,
          lon: Array.isArray(v) ? v[2] || null : null,
          track: Array.isArray(v) ? v[3] || null : null,
          altitude: Array.isArray(v) ? v[4] || null : null,
          speed: Array.isArray(v) ? v[5] || null : null,
          squawk: Array.isArray(v) ? String(v[6] || '') : '',
        }));
      }
    } catch { /* fall through to dump1090 */ }

    if (!aircraft.length) {
      const { data } = await axios.get(`${ADSB_URL}/data/aircraft.json`, { timeout: 5000 });
      aircraft = (data.aircraft || data || []).map(a => ({
        hex: a.hex,
        flight: (a.flight || '').trim(),
        altitude: a.alt_baro ?? a.altitude,
        speed: a.gs ?? a.speed,
        track: a.track,
        lat: a.lat,
        lon: a.lon,
        squawk: a.squawk,
        seen: a.seen,
      }));
    }

    return { source, count: aircraft.length, aircraft: aircraft.slice(0, 50) };
  } catch {
    return { count: 0, aircraft: [], error: { message: 'ADS-B receiver not reachable' } };
  }
});

module.exports = { list };
