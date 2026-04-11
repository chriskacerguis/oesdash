const router = require('express').Router();
const ercotController = require('../src/controllers/ercot');

router.get('/', ercotController.list);

module.exports = router;
