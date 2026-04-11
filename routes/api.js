const express = require('express');
const router = express.Router();

router.use('/config', require('./config'));
router.use('/weather', require('./weather'));
router.use('/gauges', require('./gauges'));
router.use('/aqi', require('./aqi'));
router.use('/ercot', require('./ercot'));
router.use('/adsb', require('./adsb'));
router.use('/airports', require('./airports'));
router.use('/floods', require('./floods'));
router.use('/spc', require('./spc'));
router.use('/tropical', require('./tropical'));
router.use('/earthquakes', require('./earthquakes'));
router.use('/spaceweather', require('./spaceweather'));
router.use('/hfprop', require('./hfprop'));
router.use('/satellite', require('./satellite'));
router.use('/wildfires', require('./wildfires'));
router.use('/emissions', require('./emissions'));
router.use('/sun', require('./sun'));
router.use('/links', require('./links'));

module.exports = router;
