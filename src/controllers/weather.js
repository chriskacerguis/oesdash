const axios = require('axios');
const config = require('../config');
const { cached } = require('../cache');
const { nwsHeaders, getNwsPoint } = require('../nws');

const LAT = config.stationLat;
const LON = config.stationLon;
const AW_APP_KEY = config.ambientAppKey;
const AW_API_KEY = config.ambientApiKey;

const current = cached('weather_current', 60_000, async () => {
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

  const stationsUrl = `https://api.weather.gov/points/${LAT},${LON}/stations`;
  const { data: stationData } = await axios.get(stationsUrl, { headers: nwsHeaders, timeout: 10000 });
  const stationId = stationData.features[0].properties.stationIdentifier;
  const { data } = await axios.get(
    `https://api.weather.gov/stations/${stationId}/observations/latest`,
    { headers: nwsHeaders, timeout: 10000 }
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
});

const forecast = cached('weather_forecast', 600_000, async () => {
  const { office, gridX, gridY } = await getNwsPoint();
  const { data } = await axios.get(
    `https://api.weather.gov/gridpoints/${office}/${gridX},${gridY}/forecast`,
    { headers: nwsHeaders, timeout: 10000 }
  );
  return data.properties.periods.slice(0, 8);
});

const alerts = cached('weather_alerts', 60_000, async () => {
  const { zones } = await getNwsPoint();
  const { data } = await axios.get(
    `https://api.weather.gov/alerts/active?zone=${zones.join(',')}`,
    { headers: nwsHeaders, timeout: 10000 }
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
});

const radar = cached('weather_radar', 120_000, async () => {
  const radarStation = 'KEWX';
  return {
    station: radarStation,
    reflectivityUrl: `https://radar.weather.gov/ridge/standard/${radarStation}_loop.gif`,
    velocityUrl: `https://radar.weather.gov/ridge/standard/${radarStation}_0.gif`,
    viewUrl: `https://radar.weather.gov/station/${radarStation}/standard`,
  };
});

module.exports = { current, forecast, alerts, radar };
