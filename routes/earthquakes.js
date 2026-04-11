const router = require('express').Router();
const earthquakesController = require('../src/controllers/earthquakes');

router.get('/', earthquakesController.list);

module.exports = router;
