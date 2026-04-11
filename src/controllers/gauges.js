const axios = require('axios');
const { cached } = require('../cache');

const GAUGE_SITES = {
  'Barton Creek at Loop 360': '08155300',
  'Onion Creek at US 183': '08158700',
  'Brushy Creek at Round Rock': '08104900',
  'Colorado River at Austin': '08158000',
};

const list = cached('usgs_gauges', 300_000, async () => {
  const siteIds = Object.values(GAUGE_SITES).join(',');
  const { data } = await axios.get(
    `https://waterservices.usgs.gov/nwis/iv/?format=json&sites=${siteIds}&parameterCd=00065,00060&siteStatus=active`,
    { headers: { 'User-Agent': 'OES-Dashboard/1.0', Accept: 'application/json' }, timeout: 15000 }
  );
  const series = data.value.timeSeries || [];
  const sitesMap = {};
  for (const ts of series) {
    const name = ts.sourceInfo.siteName;
    const siteCode = ts.sourceInfo.siteCode[0].value;
    const paramCode = ts.variable.variableCode[0].value;
    const paramName = paramCode === '00065' ? 'gageHeight' : 'discharge';
    const latestVal = ts.values[0]?.value[0];
    if (!sitesMap[siteCode]) {
      sitesMap[siteCode] = { name, siteCode, lat: ts.sourceInfo.geoLocation.geogLocation.latitude, lon: ts.sourceInfo.geoLocation.geogLocation.longitude };
    }
    sitesMap[siteCode][paramName] = latestVal ? { value: +latestVal.value, dateTime: latestVal.dateTime } : null;
  }
  return Object.values(sitesMap);
});

module.exports = { list };
