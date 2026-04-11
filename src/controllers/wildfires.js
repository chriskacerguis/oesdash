const axios = require('axios');
const config = require('../config');
const { cached } = require('../cache');
const { distanceMiles } = require('../utils/geo');

const LAT = config.stationLat;
const LON = config.stationLon;
const FIRE_RADIUS_MILES = 100;

const list = cached('nifc_wildfires', 600_000, async () => {
  const { data } = await axios.get(
    'https://services3.arcgis.com/T4QMspbfLg3qTGWY/arcgis/rest/services/WFIGS_Interagency_Perimeters/FeatureServer/0/query?where=1%3D1&outFields=poly_IncidentName,poly_Acres,poly_DateCurrent,irwin_FireDiscoveryDateTime,irwin_PercentContained,irwin_POOState&resultRecordCount=30&orderByFields=poly_DateCurrent DESC&f=json&geometry=-100,28,-94,33&geometryType=esriGeometryEnvelope&inSR=4326&spatialRel=esriSpatialRelIntersects&returnGeometry=true',
    { timeout: 15000 }
  );
  const fires = (data.features || []).map(f => {
    const a = f.attributes;
    const g = f.geometry;
    let lat = null, lon = null;
    if (g && g.rings && g.rings[0]) {
      const ring = g.rings[0];
      lon = ring.reduce((s, p) => s + p[0], 0) / ring.length;
      lat = ring.reduce((s, p) => s + p[1], 0) / ring.length;
    }
    const dist = (lat != null && lon != null) ? distanceMiles(LAT, LON, lat, lon) : Infinity;
    return {
      name: a.poly_IncidentName,
      acres: a.poly_Acres,
      contained: a.irwin_PercentContained,
      state: a.irwin_POOState,
      lat, lon,
      distMi: Math.round(dist),
      discovered: a.irwin_FireDiscoveryDateTime ? new Date(a.irwin_FireDiscoveryDateTime).toISOString() : null,
      updated: a.poly_DateCurrent ? new Date(a.poly_DateCurrent).toISOString() : null,
    };
  }).filter(f => f.distMi <= FIRE_RADIUS_MILES);
  fires.sort((a, b) => a.distMi - b.distMi);
  return {
    fires,
    nifcUrl: 'https://data-nifc.opendata.arcgis.com/',
  };
});

module.exports = { list };
