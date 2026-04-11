const router = require('express').Router();
const airportsController = require('../src/controllers/airports');

router.get('/', airportsController.list);

module.exports = router;
