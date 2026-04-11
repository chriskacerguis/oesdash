const axios = require('axios');
const config = require('../config');
const { cached } = require('../cache');
const { pointInGeometry } = require('../utils/geo');

const LON = config.stationLon;
const LAT = config.stationLat;

const SPC_RISK_ORDER = ['TSTM', 'MRGL', 'SLGT', 'ENH', 'MDT', 'HIGH'];
const SPC_RISK_LABELS = {
  TSTM: 'General Thunderstorms',
  MRGL: 'Marginal Risk',
  SLGT: 'Slight Risk',
  ENH: 'Enhanced Risk',
  MDT: 'Moderate Risk',
  HIGH: 'High Risk',
};

const list = cached('spc_outlooks', 600_000, async () => {
  const [dayOneRes, mdRes] = await Promise.allSettled([
    axios.get('https://www.spc.noaa.gov/products/outlook/day1otlk_cat.nolyr.geojson', { timeout: 10000 }),
    axios.get('https://www.spc.noaa.gov/products/md/md.geojson', { timeout: 10000 }),
  ]);

  let dayOneOutlook = null;
  if (dayOneRes.status === 'fulfilled') {
    const features = dayOneRes.value.data.features || [];
    const stationPoint = [LON, LAT];
    const local = features.filter(f => pointInGeometry(stationPoint, f.geometry));
    if (local.length) {
      let highest = null;
      for (const f of local) {
        const cat = (f.properties.LABEL || f.properties.LABEL2 || f.properties.cat || '').replace(/\s/g, '').toUpperCase();
        const rank = SPC_RISK_ORDER.indexOf(cat);
        if (!highest || rank > SPC_RISK_ORDER.indexOf(highest.catKey)) {
          highest = { catKey: cat, feature: f };
        }
      }
      if (highest) {
        const f = highest.feature;
        const rawCat = f.properties.LABEL || f.properties.LABEL2 || f.properties.cat || '';
        const label = SPC_RISK_LABELS[highest.catKey] || rawCat;
        dayOneOutlook = [{
          category: label,
          stroke: f.properties.stroke,
          fill: f.properties.fill,
        }];
      }
    }
  }

  let discussions = [];
  if (mdRes.status === 'fulfilled') {
    const features = mdRes.value.data.features || [];
    discussions = features.map(f => ({
      id: f.properties.MDNUM || f.properties.id,
      concern: f.properties.CONCERN || f.properties.concern || '',
      expiration: f.properties.EXPIRATIONUTC || f.properties.EXPIRE,
      url: `https://www.spc.noaa.gov/products/md/md${String(f.properties.MDNUM || f.properties.id).padStart(4, '0')}.html`,
    })).slice(0, 10);
  }

  return {
    dayOneOutlook,
    discussions,
    spcUrl: 'https://www.spc.noaa.gov/',
  };
});

module.exports = { list };
