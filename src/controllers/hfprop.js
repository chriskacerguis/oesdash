const axios = require('axios');
const config = require('../config');
const { cached } = require('../cache');

const LAT = config.stationLat;
const LON = config.stationLon;

const list = cached('hf_propagation', 300_000, async () => {
  const gLon = Math.floor((LON + 180) / 20);
  const gLat = Math.floor((LAT + 90) / 10);
  const sLon = Math.floor(((LON + 180) % 20) / 2);
  const sLat = Math.floor(((LAT + 90) % 10));
  const grid = String.fromCharCode(65 + gLon) + String.fromCharCode(65 + gLat)
    + sLon + sLat
    + String.fromCharCode(97 + Math.floor(((LON + 180) % 2) * 12))
    + String.fromCharCode(97 + Math.floor(((LAT + 90) % 1) * 24));
  const grid4 = grid.substring(0, 4);

  const [fluxRes, propRes] = await Promise.allSettled([
    axios.get('https://services.swpc.noaa.gov/products/summary/10cm-flux.json', { timeout: 10000 }),
    axios.get('https://prop.kc2g.com/api/ptp.json', {
      params: { from_grid: grid4, to_grid: grid4 },
      timeout: 10000,
      transformResponse: [data => JSON.parse(data.replace(/\bNaN\b/g, 'null'))],
    }),
  ]);

  let solarFlux = null;
  if (fluxRes.status === 'fulfilled' && fluxRes.value.data) {
    const fd = fluxRes.value.data;
    const entry = Array.isArray(fd) ? fd[0] : fd;
    solarFlux = entry.flux || entry.Flux || null;
  }

  let muf = null;
  let luf = null;

  if (propRes.status === 'fulfilled' && Array.isArray(propRes.value.data) && propRes.value.data.length) {
    const now = Math.floor(Date.now() / 1000);
    let closest = propRes.value.data[0];
    let minDiff = Math.abs(now - closest.ts);
    for (const entry of propRes.value.data) {
      const diff = Math.abs(now - entry.ts);
      if (diff < minDiff) { closest = entry; minDiff = diff; }
    }
    const m = closest.metrics;
    if (m) {
      muf = isFinite(m.muf_lp) ? +m.muf_lp.toFixed(1) : (isFinite(m.muf_sp) ? +m.muf_sp.toFixed(1) : null);
      luf = isFinite(m.luf_lp) ? +m.luf_lp.toFixed(1) : (isFinite(m.luf_sp) ? +m.luf_sp.toFixed(1) : null);
    }
  }

  return {
    muf,
    luf,
    solarFlux: solarFlux ? +solarFlux : null,
    grid: grid4,
  };
});

module.exports = { list };
