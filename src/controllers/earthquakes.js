const axios = require('axios');
const config = require('../config');
const { cached } = require('../cache');
const { distanceMiles } = require('../utils/geo');

const LAT = config.stationLat;
const LON = config.stationLon;

const list = cached('usgs_earthquakes', 300_000, async () => {
  const { data } = await axios.get(
    `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&latitude=${LAT}&longitude=${LON}&maxradiuskm=161&minmagnitude=2.0&orderby=time&limit=20`,
    { timeout: 10000 }
  );
  const events = (data.features || []).map(f => {
    const eLat = f.geometry?.coordinates?.[1];
    const eLon = f.geometry?.coordinates?.[0];
    const dist = (eLat != null && eLon != null) ? distanceMiles(LAT, LON, eLat, eLon) : Infinity;
    return {
      magnitude: f.properties.mag,
      place: f.properties.place,
      time: new Date(f.properties.time).toISOString(),
      depth: f.geometry?.coordinates?.[2],
      lat: eLat,
      lon: eLon,
      url: f.properties.url,
      felt: f.properties.felt,
      tsunami: f.properties.tsunami,
      distMi: Math.round(dist),
    };
  });
  events.sort((a, b) => a.distMi - b.distMi);
  return {
    count: data.metadata?.count || 0,
    events,
  };
});

module.exports = { list };
