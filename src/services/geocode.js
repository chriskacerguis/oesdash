const axios = require('axios');

async function reverseGeocode(lat, lon) {
  const { data } = await axios.get(
    `https://geocoding.geo.census.gov/geocoder/geographies/coordinates?x=${lon}&y=${lat}&benchmark=Public_AR_Current&vintage=Current_Current&format=json`,
    { timeout: 10000 }
  );
  const geo = data.result?.geographies;
  const place = geo?.['Incorporated Places']?.[0] || geo?.['Census Designated Places']?.[0];
  const county = geo?.['Counties']?.[0];
  const state = geo?.['States']?.[0];
  const city = place?.NAME || county?.NAME || null;
  const stateAbbr = state?.STUSAB || null;
  const cleanCity = city ? city.replace(/\s+CDP$/i, '').replace(/\s+city$/i, '') : null;
  return cleanCity && stateAbbr ? `${cleanCity}, ${stateAbbr}` : null;
}

module.exports = { reverseGeocode };
