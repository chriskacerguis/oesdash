module.exports = {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  logLevel: process.env.LOG_LEVEL || 'info',
  stationLat: parseFloat(process.env.STATION_LAT || '30.2672'),
  stationLon: parseFloat(process.env.STATION_LON || '-97.7431'),
  airnowApiKey: process.env.AIRNOW_API_KEY || '',
  adsbUrl: process.env.ADSB_URL || 'http://localhost:8080',
  ambientAppKey: process.env.AMBIENT_APP_KEY || '',
  ambientApiKey: process.env.AMBIENT_API_KEY || '',
  rateLimitEnabled: process.env.RATE_LIMIT_ENABLED !== 'false',
};
