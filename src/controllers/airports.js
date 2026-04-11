const axios = require('axios');
const { cached } = require('../cache');

const AIRPORT_IDS = ['KAUS', 'KEDC'];

const list = cached('airport_status', 120_000, async () => {
  const ids = AIRPORT_IDS.join(',');
  const [metarRes, tafRes, nasRes] = await Promise.allSettled([
    axios.get(`https://aviationweather.gov/api/data/metar?ids=${ids}&format=json`, { timeout: 10000 })
      .then(r => Array.isArray(r.data) ? r : { data: [] }),
    axios.get(`https://aviationweather.gov/api/data/taf?ids=${ids}&format=json`, { timeout: 10000 })
      .then(r => Array.isArray(r.data) ? r : { data: [] }),
    axios.get('https://nasstatus.faa.gov/api/airport-status-information', { timeout: 10000 }),
  ]);

  const metars = metarRes.status === 'fulfilled' ? metarRes.value.data : [];
  const tafs = tafRes.status === 'fulfilled' ? tafRes.value.data : [];

  // If METAR fetch failed entirely, throw so the cache layer doesn't store a degraded result
  if (!metars.length && metarRes.status === 'rejected') {
    throw new Error(`METAR fetch failed: ${metarRes.reason?.message || 'unknown'}`);
  }

  let nasDelays = [];
  let nasClosures = [];
  if (nasRes.status === 'fulfilled') {
    const xml = nasRes.value.data;
    const faaIds = AIRPORT_IDS.map(id => id.substring(1));
    const gdMatches = xml.match(/<Ground_Delay>[\s\S]*?<\/Ground_Delay>/g) || [];
    for (const gd of gdMatches) {
      const arpt = (gd.match(/<ARPT>(.*?)<\/ARPT>/) || [])[1];
      if (faaIds.includes(arpt)) {
        nasDelays.push({
          airport: arpt,
          type: 'Ground Delay',
          reason: (gd.match(/<Reason>(.*?)<\/Reason>/) || [])[1] || '',
          avg: (gd.match(/<Avg>(.*?)<\/Avg>/) || [])[1] || '',
          max: (gd.match(/<Max>(.*?)<\/Max>/) || [])[1] || '',
        });
      }
    }
    const gsMatches = xml.match(/<Program>[\s\S]*?<\/Program>/g) || [];
    for (const gs of gsMatches) {
      const arpt = (gs.match(/<ARPT>(.*?)<\/ARPT>/) || [])[1];
      if (faaIds.includes(arpt)) {
        nasDelays.push({
          airport: arpt,
          type: 'Ground Stop',
          reason: (gs.match(/<Reason>(.*?)<\/Reason>/) || [])[1] || '',
          endTime: (gs.match(/<End_Time>(.*?)<\/End_Time>/) || [])[1] || '',
        });
      }
    }
    const clMatches = xml.match(/<Airport>[\s\S]*?<\/Airport>/g) || [];
    for (const cl of clMatches) {
      const arpt = (cl.match(/<ARPT>(.*?)<\/ARPT>/) || [])[1];
      if (faaIds.includes(arpt)) {
        nasClosures.push({
          airport: arpt,
          reason: (cl.match(/<Reason>(.*?)<\/Reason>/) || [])[1] || '',
          start: (cl.match(/<Start>(.*?)<\/Start>/) || [])[1] || '',
          reopen: (cl.match(/<Reopen>(.*?)<\/Reopen>/) || [])[1] || '',
        });
      }
    }
  }

  const airports = AIRPORT_IDS.map(id => {
    const metar = metars.find(m => m.icaoId === id) || null;
    const taf = tafs.find(t => t.icaoId === id) || null;
    const faaId = id.substring(1);
    return {
      icao: id,
      faa: faaId,
      name: metar?.name || id,
      metar: metar ? {
        raw: metar.rawOb,
        temp: metar.temp,
        dewpoint: metar.dewp,
        wind: metar.wdir != null ? `${String(metar.wdir).padStart(3, '0')}° ${metar.wspd}kt${metar.wgst ? ' G' + metar.wgst + 'kt' : ''}` : null,
        visibility: metar.visib,
        altimeter: metar.altim != null ? +(metar.altim * 0.02953).toFixed(2) : null,
        flightCategory: metar.fltCat,
        clouds: metar.clouds || [],
        obsTime: metar.reportTime,
      } : null,
      taf: taf ? { raw: taf.rawTAF } : null,
      delays: nasDelays.filter(d => d.airport === faaId),
      closures: nasClosures.filter(c => c.airport === faaId),
    };
  });
  return airports;
});

module.exports = { list };
