const axios = require('axios');
const { cached } = require('../cache');

const list = cached('space_weather', 300_000, async () => {
  const [kpRes, alertRes, scaleRes, fluxRes] = await Promise.allSettled([
    axios.get('https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json', { timeout: 10000 }),
    axios.get('https://services.swpc.noaa.gov/products/alerts.json', { timeout: 10000 }),
    axios.get('https://services.swpc.noaa.gov/products/noaa-scales.json', { timeout: 10000 }),
    axios.get('https://services.swpc.noaa.gov/products/summary/10cm-flux.json', { timeout: 10000 }),
  ]);

  let kpIndex = null;
  if (kpRes.status === 'fulfilled' && kpRes.value.data.length > 1) {
    const latest = kpRes.value.data[kpRes.value.data.length - 1];
    if (Array.isArray(latest)) {
      kpIndex = { time: latest[0], kp: +latest[1], observed: latest[2] };
    } else if (latest && latest.time_tag != null) {
      kpIndex = { time: latest.time_tag, kp: +latest.Kp, observed: latest.station_count };
    }
  }

  let alerts = [];
  if (alertRes.status === 'fulfilled') {
    alerts = alertRes.value.data.slice(0, 5).map(a => ({
      productId: a.product_id,
      issueTime: a.issue_datetime,
      message: (a.message || '').substring(0, 300),
    }));
  }

  let scales = null;
  if (scaleRes.status === 'fulfilled' && scaleRes.value.data) {
    const s = scaleRes.value.data[0] || scaleRes.value.data;
    const fmt = (obj, prefix) => {
      if (!obj) return 'N/A';
      if (typeof obj === 'string') return obj;
      return obj.Scale != null ? `${prefix}${obj.Scale} — ${obj.Text || 'none'}` : JSON.stringify(obj);
    };
    scales = {
      geoStorm: fmt(s.G || s['-1']?.G, 'G'),
      solarRadiation: fmt(s.S || s['-1']?.S, 'S'),
      radioBlackout: fmt(s.R || s['-1']?.R, 'R'),
    };
  }

  let solarFlux = null;
  if (fluxRes.status === 'fulfilled' && fluxRes.value.data) {
    const fd = fluxRes.value.data;
    const entry = Array.isArray(fd) ? fd[0] : fd;
    solarFlux = entry.flux || entry.Flux || null;
    if (solarFlux) solarFlux = +solarFlux;
  }

  return {
    kpIndex,
    alerts,
    scales,
    solarFlux,
    swpcUrl: 'https://www.swpc.noaa.gov/',
  };
});

module.exports = { list };
