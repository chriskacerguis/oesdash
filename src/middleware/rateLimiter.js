const rateLimit = require('express-rate-limit');
const config = require('../config');

const apiLimiter = config.rateLimitEnabled
  ? rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 500,                  // 500 requests per window per IP
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: { message: 'Too many requests, please try again later' } },
    })
  : (_req, _res, next) => next();

module.exports = apiLimiter;
