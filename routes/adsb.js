const router = require('express').Router();
const adsbController = require('../src/controllers/adsb');

router.get('/', adsbController.list);

module.exports = router;
