const router = require('express').Router();
const aqiController = require('../src/controllers/aqi');

router.get('/', aqiController.list);

module.exports = router;
