const router = require('express').Router();
const gaugesController = require('../src/controllers/gauges');

router.get('/', gaugesController.list);

module.exports = router;
