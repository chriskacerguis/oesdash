const express = require('express');
const axios = require('axios');
const router = express.Router();

const LAT = process.env.STATION_LAT || '30.2672';
const LON = process.env.STATION_LON || '-97.7431';
const NWS_OFFICE = process.env.NWS_OFFICE || 'EWX';
const NWS_GRID_X = process.env.NWS_GRID_X || '157';
const NWS_GRID_Y = process.env.NWS_GRID_Y || '95';
const AIRNOW_KEY = process.env.AIRNOW_API_KEY || '';
const ADSB_URL = process.env.ADSB_URL || 'http://localhost:8080';
const AW_APP_KEY = process.env.AMBIENT_APP_KEY || '';
const AW_API_KEY = process.env.AMBIENT_API_KEY || '';

const nwsHeaders = { 'User-Agent': 'OES-Dashboard/1.0 (emergency-ops@localhost)', Accept: 'application/geo+json' };

// Simple in-memory cache
const cache = {};
function cached(key, ttlMs, fetcher) {
  return async (_req, res) => {
    const now = Date.now();
    if (cache[key] && now - cache[key].ts < ttlMs) {
      return res.json(cache[key].data);
    }
    try {
      const data = await fetcher();
      cache[key] = { data, ts: now };
      res.json(data);
    } catch (err) {
      console.error(`[${key}]`, err.message);
      if (cache[key]) return res.json(cache[key].data);
      res.status(502).json({ error: `Failed to fetch ${key}`, message: err.message });
    }
  };
}

// ── Weather Current Conditions (Ambient Weather primary, NWS fallback) ──────
router.get('/weather/current', cached('weather_current', 60_000, async () => {
  // Try Ambient Weather station first
  if (AW_APP_KEY && AW_API_KEY) {
    const { data: devices } = await axios.get(
      `https://rt.ambientweather.net/v1/devices?applicationKey=${AW_APP_KEY}&apiKey=${AW_API_KEY}`,
      { timeout: 10000 }
    );
    if (devices.length) {
      const d = devices[0].lastData;
      const info = devices[0].info || {};
      return {
        source: 'Ambient Weather',
        station: info.name || 'On-Site Station',
        timestamp: d.date || new Date(d.dateutc).toISOString(),
        temperature: d.tempf ?? null,
        humidity: d.humidity ?? null,
        windSpeed: d.windspeedmph ?? null,
        windDirection: d.winddir ?? null,
        windGust: d.windgustmph ?? null,
        maxDailyGust: d.maxdailygust ?? null,
        barometer: d.baromrelin ?? null,
        precipitation1h: d.hourlyrainin ?? null,
        dailyRain: d.dailyrainin ?? null,
        monthlyRain: d.monthlyrainin ?? null,
        yearlyRain: d.yearlyrainin ?? null,
        description: null,
        icon: null,
        feelsLike: d.feelsLike ?? null,
        dewPoint: d.dewPoint != null ? +d.dewPoint.toFixed(1) : null,
        uv: d.uv ?? null,
        solarRadiation: d.solarradiation ?? null,
        tempIndoor: d.tempinf ?? null,
        humidityIndoor: d.humidityin ?? null,
        visibility: null,
      };
    }
  }

  // Fallback: NWS
  const stationsUrl = `https://api.weather.gov/points/${LAT},${LON}/stations`;
  const { data: stationData } = await axios.get(stationsUrl, { headers: nwsHeaders });
  const stationId = stationData.features[0].properties.stationIdentifier;
  const { data } = await axios.get(
    `https://api.weather.gov/stations/${stationId}/observations/latest`,
    { headers: nwsHeaders }
  );
  const p = data.properties;
  return {
    source: 'NWS',
    station: stationId,
    timestamp: p.timestamp,
    temperature: p.temperature?.value != null ? +(p.temperature.value * 9 / 5 + 32).toFixed(1) : null,
    humidity: p.relativeHumidity?.value != null ? +p.relativeHumidity.value.toFixed(0) : null,
    windSpeed: p.windSpeed?.value != null ? +(p.windSpeed.value * 0.621371).toFixed(1) : null,
    windDirection: p.windDirection?.value ?? null,
    windGust: p.windGust?.value != null ? +(p.windGust.value * 0.621371).toFixed(1) : null,
    maxDailyGust: null,
    barometer: p.barometricPressure?.value != null ? +(p.barometricPressure.value / 3386.39).toFixed(2) : null,
    precipitation1h: p.precipitationLastHour?.value != null ? +(p.precipitationLastHour.value / 25.4).toFixed(2) : null,
    dailyRain: null,
    monthlyRain: null,
    yearlyRain: null,
    description: p.textDescription,
    icon: p.icon,
    feelsLike: p.heatIndex?.value != null ? +(p.heatIndex.value * 9 / 5 + 32).toFixed(1) : (p.windChill?.value != null ? +(p.windChill.value * 9 / 5 + 32).toFixed(1) : null),
    dewPoint: p.dewpoint?.value != null ? +(p.dewpoint.value * 9 / 5 + 32).toFixed(1) : null,
    uv: null,
    solarRadiation: null,
    tempIndoor: null,
    humidityIndoor: null,
    visibility: p.visibility?.value != null ? +(p.visibility.value / 1609.34).toFixed(1) : null,
  };
}));

// ── NWS Forecast ────────────────────────────────────────────────────────────
router.get('/weather/forecast', cached('weather_forecast', 600_000, async () => {
  const { data } = await axios.get(
    `https://api.weather.gov/gridpoints/${NWS_OFFICE}/${NWS_GRID_X},${NWS_GRID_Y}/forecast`,
    { headers: nwsHeaders }
  );
  return data.properties.periods.slice(0, 8);
}));

// ── NWS Alerts (Austin area) ────────────────────────────────────────────────
router.get('/weather/alerts', cached('weather_alerts', 60_000, async () => {
  const { data } = await axios.get(
    `https://api.weather.gov/alerts/active?point=${LAT},${LON}`,
    { headers: nwsHeaders }
  );
  return data.features.map(f => ({
    id: f.properties.id,
    event: f.properties.event,
    severity: f.properties.severity,
    headline: f.properties.headline,
    description: f.properties.description,
    onset: f.properties.onset,
    expires: f.properties.expires,
    senderName: f.properties.senderName,
    geometry: f.geometry || null,
  }));
}));

// ── NWS Radar (latest imagery URL) ──────────────────────────────────────────
router.get('/weather/radar', cached('weather_radar', 120_000, async () => {
  const radarStation = 'KEWX';
  return {
    station: radarStation,
    reflectivityUrl: `https://radar.weather.gov/ridge/standard/${radarStation}_loop.gif`,
    velocityUrl: `https://radar.weather.gov/ridge/standard/${radarStation}_0.gif`,
    viewUrl: `https://radar.weather.gov/station/${radarStation}/standard`,
  };
}));

// ── USGS Stream Gauges ──────────────────────────────────────────────────────
const GAUGE_SITES = {
  'Barton Creek at Loop 360': '08155300',
  'Onion Creek at US 183': '08158700',
  'Brushy Creek at Round Rock': '08104900',
  'Colorado River at Austin': '08158000',
};

router.get('/gauges', cached('usgs_gauges', 300_000, async () => {
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
}));

// ── AirNow AQI ──────────────────────────────────────────────────────────────
router.get('/aqi', cached('airnow_aqi', 600_000, async () => {
  if (!AIRNOW_KEY) {
    return { error: 'AIRNOW_API_KEY not configured', aqi: null, category: 'Unknown' };
  }
  const { data } = await axios.get(
    `https://www.airnowapi.org/aq/observation/latLong/current/?format=application/json&latitude=${LAT}&longitude=${LON}&distance=25&API_KEY=${AIRNOW_KEY}`
  );
  return data.map(d => ({
    parameter: d.ParameterName,
    aqi: d.AQI,
    category: d.Category.Name,
    dateObserved: d.DateObserved,
    reportingArea: d.ReportingArea,
  }));
}));

// ── ERCOT Grid Status ───────────────────────────────────────────────────────
router.get('/ercot', cached('ercot_grid', 300_000, async () => {
  try {
    const { data } = await axios.get(
      'https://www.ercot.com/api/1/services/read/dashboards/todays-outlook.json',
      { timeout: 10000, headers: { Accept: 'application/json' } }
    );
    return {
      currentDemand: data.currentCondition?.demand,
      capacity: data.currentCondition?.capacity,
      operatingReserves: data.currentCondition?.operatingReserves,
      status: data.currentCondition?.epiStatus || 'Normal',
      lastUpdated: data.currentCondition?.lastUpdated,
    };
  } catch {
    return {
      status: 'Normal',
      note: 'ERCOT data may be unavailable — check https://www.ercot.com/gridmktinfo/dashboards',
      dashboardUrl: 'https://www.ercot.com/gridmktinfo/dashboards',
    };
  }
}));

// ── ADS-B Aircraft (supports dump1090 and FR24 feeder formats) ──────────────
router.get('/adsb', cached('adsb_aircraft', 10_000, async () => {
  try {
    // Try FR24 feeder format first (port 8754 /flights.json)
    let aircraft = [];
    let source = 'dump1090';
    try {
      const { data } = await axios.get(`${ADSB_URL}/flights.json`, { timeout: 5000 });
      if (data && typeof data === 'object' && !Array.isArray(data) && !data.aircraft) {
        // FR24 format: { "hex": ["hex", lat, lon, track, alt, speed, squawk, ...], ... }
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

    // Fallback: dump1090 / readsb format
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
    return { count: 0, aircraft: [], note: 'ADS-B receiver not reachable' };
  }
}));

// ── Airport Status (METAR + TAF + FAA NAS delays) ──────────────────────────
const AIRPORT_IDS = ['KAUS', 'KEDC', 'KSAT'];

router.get('/airports', cached('airport_status', 120_000, async () => {
  const ids = AIRPORT_IDS.join(',');
  const [metarRes, tafRes, nasRes] = await Promise.allSettled([
    axios.get(`https://aviationweather.gov/api/data/metar?ids=${ids}&format=json`, { timeout: 10000 }),
    axios.get(`https://aviationweather.gov/api/data/taf?ids=${ids}&format=json`, { timeout: 10000 }),
    axios.get('https://nasstatus.faa.gov/api/airport-status-information', { timeout: 10000 }),
  ]);

  const metars = metarRes.status === 'fulfilled' ? metarRes.value.data : [];
  const tafs = tafRes.status === 'fulfilled' ? tafRes.value.data : [];

  // Parse FAA NAS XML for delays/closures mentioning our airports
  let nasDelays = [];
  let nasClosures = [];
  if (nasRes.status === 'fulfilled') {
    const xml = nasRes.value.data;
    const faaIds = AIRPORT_IDS.map(id => id.substring(1)); // FAA uses 3-letter codes
    // Ground delays
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
    // Ground stops
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
    // Closures
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
}));

// ── ATXFloods Low-Water Crossings ───────────────────────────────────────────
router.get('/floods', cached('atxfloods', 120_000, async () => {
  try {
    const { data } = await axios.get(
      'https://api.atxfloods.com/api/closures',
      { timeout: 10000, headers: { Accept: 'application/json' } }
    );
    const crossings = data.attributes || data;
    if (Array.isArray(crossings)) {
      return crossings.map(c => ({
        name: c.name,
        status: c.status || c.status_id,
        address: c.address,
        jurisdiction: c.jurisdiction,
        comment: c.comment,
        updatedAt: c.updated_at || c.updatedAt,
        lat: c.lat || c.latitude,
        lon: c.lon || c.longitude,
      }));
    }
    return crossings;
  } catch {
    return { note: 'ATXFloods data unavailable — check https://www.atxfloods.com', crossings: [] };
  }
}));

// ── SPC Severe Weather Outlooks ─────────────────────────────────────────────
router.get('/spc', cached('spc_outlooks', 600_000, async () => {
  const [dayOneRes, mdRes] = await Promise.allSettled([
    axios.get('https://www.spc.noaa.gov/products/outlook/day1otlk_cat.nolyr.geojson', { timeout: 10000 }),
    axios.get('https://www.spc.noaa.gov/products/md/md.geojson', { timeout: 10000 }),
  ]);

  let dayOneOutlook = null;
  if (dayOneRes.status === 'fulfilled') {
    const features = dayOneRes.value.data.features || [];
    // Find the highest risk level that covers our area, or just return all categories
    dayOneOutlook = features.map(f => ({
      category: f.properties.LABEL || f.properties.LABEL2 || f.properties.cat,
      stroke: f.properties.stroke,
      fill: f.properties.fill,
    }));
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
}));

// ── NHC Tropical Cyclones ───────────────────────────────────────────────────
router.get('/tropical', cached('nhc_tropical', 600_000, async () => {
  try {
    const { data } = await axios.get(
      'https://www.nhc.noaa.gov/CurrentSummary.json',
      { timeout: 10000, headers: { Accept: 'application/json' } }
    );
    return data;
  } catch {
    // Fallback: try the active cyclones GIS feed
    try {
      const { data } = await axios.get(
        'https://www.nhc.noaa.gov/gis/forecast/archive/active_forecast.json',
        { timeout: 10000 }
      );
      return data;
    } catch {
      // Fallback to NWS alerts for tropical
      const { data } = await axios.get(
        'https://api.weather.gov/alerts/active?event=Tropical%20Storm%20Warning,Hurricane%20Warning,Tropical%20Storm%20Watch,Hurricane%20Watch',
        { timeout: 10000, headers: nwsHeaders }
      );
      return {
        activeStorms: data.features.length > 0,
        alerts: data.features.map(f => ({
          event: f.properties.event,
          headline: f.properties.headline,
          severity: f.properties.severity,
          areas: f.properties.areaDesc,
        })).slice(0, 5),
        nhcUrl: 'https://www.nhc.noaa.gov/',
      };
    }
  }
}));

// ── USGS Earthquakes ────────────────────────────────────────────────────────
router.get('/earthquakes', cached('usgs_earthquakes', 300_000, async () => {
  const { data } = await axios.get(
    'https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&latitude=30.2672&longitude=-97.7431&maxradiuskm=500&minmagnitude=2.0&orderby=time&limit=20',
    { timeout: 10000 }
  );
  return {
    count: data.metadata?.count || 0,
    events: (data.features || []).map(f => ({
      magnitude: f.properties.mag,
      place: f.properties.place,
      time: new Date(f.properties.time).toISOString(),
      depth: f.geometry?.coordinates?.[2],
      lat: f.geometry?.coordinates?.[1],
      lon: f.geometry?.coordinates?.[0],
      url: f.properties.url,
      felt: f.properties.felt,
      tsunami: f.properties.tsunami,
    })),
  };
}));

// ── NOAA Space Weather ──────────────────────────────────────────────────────
router.get('/spaceweather', cached('space_weather', 300_000, async () => {
  const [kpRes, alertRes, scaleRes] = await Promise.allSettled([
    axios.get('https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json', { timeout: 10000 }),
    axios.get('https://services.swpc.noaa.gov/products/alerts.json', { timeout: 10000 }),
    axios.get('https://services.swpc.noaa.gov/products/noaa-scales.json', { timeout: 10000 }),
  ]);

  let kpIndex = null;
  if (kpRes.status === 'fulfilled' && kpRes.value.data.length > 1) {
    const latest = kpRes.value.data[kpRes.value.data.length - 1];
    kpIndex = { time: latest[0], kp: +latest[1], observed: latest[2] };
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

  return {
    kpIndex,
    alerts,
    scales,
    swpcUrl: 'https://www.swpc.noaa.gov/',
  };
}));

// ── GOES Satellite Imagery ──────────────────────────────────────────────────
router.get('/satellite', cached('goes_satellite', 300_000, async () => {
  return {
    visibleUrl: 'https://cdn.star.nesdis.noaa.gov/GOES16/ABI/SECTOR/sp/GEOCOLOR/latest.jpg',
    infraredUrl: 'https://cdn.star.nesdis.noaa.gov/GOES16/ABI/SECTOR/sp/13/latest.jpg',
    waterVaporUrl: 'https://cdn.star.nesdis.noaa.gov/GOES16/ABI/SECTOR/sp/09/latest.jpg',
    loopUrl: 'https://www.star.nesdis.noaa.gov/goes/sector_band.php?sat=G16&sector=sp&band=GEOCOLOR&length=24',
    sector: 'Southern Plains',
    satellite: 'GOES-16',
  };
}));

// ── NIFC Active Wildfires ───────────────────────────────────────────────────
router.get('/wildfires', cached('nifc_wildfires', 600_000, async () => {
  const { data } = await axios.get(
    'https://services3.arcgis.com/T4QMspbfLg3qTGWY/arcgis/rest/services/WFIGS_Interagency_Perimeters/FeatureServer/0/query?where=1%3D1&outFields=poly_IncidentName,poly_Acres,poly_DateCurrent,irwin_FireDiscoveryDateTime,irwin_PercentContained,irwin_POOState&resultRecordCount=30&orderByFields=poly_DateCurrent DESC&f=json&geometry=-100,28,-94,33&geometryType=esriGeometryEnvelope&inSR=4326&spatialRel=esriSpatialRelIntersects&returnGeometry=true',
    { timeout: 15000 }
  );
  return {
    fires: (data.features || []).map(f => {
      const a = f.attributes;
      const g = f.geometry;
      // Compute centroid from polygon rings for map marker
      let lat = null, lon = null;
      if (g && g.rings && g.rings[0]) {
        const ring = g.rings[0];
        lon = ring.reduce((s, p) => s + p[0], 0) / ring.length;
        lat = ring.reduce((s, p) => s + p[1], 0) / ring.length;
      }
      return {
        name: a.poly_IncidentName,
        acres: a.poly_Acres,
        contained: a.irwin_PercentContained,
        state: a.irwin_POOState,
        lat, lon,
        discovered: a.irwin_FireDiscoveryDateTime ? new Date(a.irwin_FireDiscoveryDateTime).toISOString() : null,
        updated: a.poly_DateCurrent ? new Date(a.poly_DateCurrent).toISOString() : null,
      };
    }),
    nifcUrl: 'https://data-nifc.opendata.arcgis.com/',
  };
}));

// ── NWS River Forecasts ─────────────────────────────────────────────────────
const RIVER_GAUGES = {
  'Barton Creek at Loop 360': 'bcrt2',
  'Onion Creek near Driftwood': 'onit2',
  'Colorado River at Austin': 'atit2',
};

router.get('/riverforecast', cached('river_forecast', 600_000, async () => {
  const results = [];
  for (const [name, gaugeId] of Object.entries(RIVER_GAUGES)) {
    try {
      const { data } = await axios.get(
        `https://api.water.noaa.gov/nwps/v1/gauges/${gaugeId}/stageflow`,
        { timeout: 10000, headers: { Accept: 'application/json' } }
      );
      const obs = data.observed?.data || [];
      const fcst = data.forecast?.data || [];
      const flood = data.flood || {};
      results.push({
        name,
        gaugeId,
        floodStage: flood.stage ?? null,
        floodCategory: flood.category ?? null,
        latestObserved: obs.length ? { value: obs[obs.length - 1].primary, time: obs[obs.length - 1].validTime } : null,
        forecast: fcst.slice(0, 6).map(f => ({ value: f.primary, time: f.validTime })),
      });
    } catch {
      results.push({ name, gaugeId, error: 'Data unavailable' });
    }
  }
  return results;
}));

// ── TCEQ Industrial Emissions Events ────────────────────────────────────────
router.get('/emissions', cached('tceq_emissions', 600_000, async () => {
  try {
    const { data } = await axios.get(
      'https://www2.tceq.texas.gov/oce/eer/index.cfm?fuession=main.getDetails&target=198&format=json',
      { timeout: 10000 }
    );
    if (typeof data === 'object') return data;
  } catch { /* fallback below */ }
  // TCEQ doesn't have a reliable JSON API; return info link
  return {
    note: 'TCEQ emissions events — check website for latest',
    url: 'https://www2.tceq.texas.gov/oce/eer/',
    rssUrl: 'https://www2.tceq.texas.gov/oce/eer/index.cfm?fuession=main.rssAll',
  };
}));

// ── Sun / Moon Ephemeris ────────────────────────────────────────────────────
router.get('/sun', cached('sun_moon', 3600_000, async () => {
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
}));

// ── External link endpoints (for services without APIs) ─────────────────────
router.get('/links', (_req, res) => {
  res.json([
    { name: 'TFS Fire Maps', url: 'https://texasforestservice.tamu.edu/wildfires/', description: 'Texas A&M Forest Service wildfire perimeter maps' },
    { name: 'TCEQ Fire/Burn Maps', url: 'https://www.tceq.texas.gov/airquality/monops/prescribed-burns', description: 'TCEQ prescribed burn notifications' },
    { name: 'TxDOT DriveTexas', url: 'https://drivetexas.org/', description: 'Road conditions and closures' },
    { name: 'Travis County OEM GIS', url: 'https://www.traviscountytx.gov/emergency-services', description: 'Travis County Emergency Management GIS feeds' },
    { name: 'ATXFloods.com', url: 'https://www.atxfloods.com', description: 'Low-water crossing status' },
    { name: 'ERCOT Dashboard', url: 'https://www.ercot.com/gridmktinfo/dashboards', description: 'ERCOT grid conditions dashboard' },
    { name: 'NWS Austin Radar', url: 'https://radar.weather.gov/station/KEWX/standard', description: 'NWS radar for Austin/San Antonio' },
    { name: 'AirNow', url: 'https://www.airnow.gov/?city=Austin&state=TX', description: 'Air quality monitoring' },
    { name: 'APRS.fi Austin', url: 'https://aprs.fi/#!lat=30.2672&lng=-97.7431&z=10', description: 'APRS station tracking map' },
    { name: 'PulsePoint', url: 'https://web.pulsepoint.org/', description: 'Real-time fire/EMS dispatch' },
    { name: 'CapMetro Alerts', url: 'https://www.capmetro.org/alerts', description: 'Austin public transit service alerts' },
    { name: 'CDC Wastewater Data', url: 'https://www.cdc.gov/nwss/wastewater-surveillance.html', description: 'Pathogen wastewater surveillance' },
  ]);
});

module.exports = router;
