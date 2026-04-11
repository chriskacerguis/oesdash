const axios = require('axios');
const config = require('../config');
const { cached } = require('../cache');

const LAT = config.stationLat;
const LON = config.stationLon;

const list = cached('sun_moon', 3600_000, async () => {
  const today = new Date().toISOString().split('T')[0];
  const { data } = await axios.get(
    `https://aa.usno.navy.mil/api/rstt/oneday?date=${today}&coords=${LAT},${LON}&tz=-5`,
    { timeout: 10000 }
  );
  const props = data.properties?.data || data;
  const sunData = props.sundata || [];
  const moonData = props.moondata || [];
  const phase = props.curphase || props.closestphase?.phase || null;

  const findTime = (arr, phenomenon) => {
    const item = arr.find(s => s.phen === phenomenon || s.phenomenon === phenomenon);
    return item ? (item.time || item.utctime) : null;
  };

  return {
    date: today,
    sunrise: findTime(sunData, 'Rise') || findTime(sunData, 'R'),
    sunset: findTime(sunData, 'Set') || findTime(sunData, 'S'),
    moonrise: findTime(moonData, 'Rise') || findTime(moonData, 'R'),
    moonset: findTime(moonData, 'Set') || findTime(moonData, 'S'),
    moonPhase: phase,
    dayLength: null,
  };
});

module.exports = { list };
