require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const pinoHttp = require('pino-http');
const logger = require('./src/logger');
const config = require('./src/config');
const apiLimiter = require('./src/middleware/rateLimiter');
const apiRoutes = require('./routes/api');

const app = express();
const PORT = config.port;

app.use(pinoHttp({
  logger,
  serializers: {
    req(req) {
      const url = req.url && req.url.split('?')[0];
      return { id: req.id, method: req.method, url };
    },
  },
}));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api', apiLimiter, apiRoutes);

app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const certPath = path.join(__dirname, 'server.crt');
const keyPath = path.join(__dirname, 'server.key');

if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
  const https = require('https');
  const options = {
    cert: fs.readFileSync(certPath),
    key: fs.readFileSync(keyPath),
  };
  https.createServer(options, app).listen(PORT, () => {
    logger.info({ port: PORT, tls: true }, 'OES Dashboard running');
  });
} else {
  app.listen(PORT, () => {
    logger.info({ port: PORT, tls: false }, 'OES Dashboard running');
  });
}
