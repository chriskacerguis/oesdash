const router = require('express').Router();
const wildfiresController = require('../src/controllers/wildfires');

router.get('/', wildfiresController.list);

module.exports = router;
