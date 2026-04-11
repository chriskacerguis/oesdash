const router = require('express').Router();
const weatherController = require('../src/controllers/weather');

router.get('/current', weatherController.current);
router.get('/forecast', weatherController.forecast);
router.get('/alerts', weatherController.alerts);
router.get('/radar', weatherController.radar);

module.exports = router;
