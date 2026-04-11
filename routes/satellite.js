const router = require('express').Router();
const satelliteController = require('../src/controllers/satellite');

router.get('/', satelliteController.list);

module.exports = router;
