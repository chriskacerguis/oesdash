const pino = require('pino');
const config = require('./config');

const { nodeEnv, logLevel } = config;

const logger = pino({
  level: logLevel,
  redact: {
    paths: ['req.headers.authorization', '*.API_KEY', '*.apiKey', '*.api_key'],
    censor: '[REDACTED]',
  },
  ...(nodeEnv === 'development' && {
    transport: {
      target: 'pino-pretty',
      options: { colorize: true },
    },
  }),
});

module.exports = logger;
