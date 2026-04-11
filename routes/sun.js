const router = require('express').Router();
const sunController = require('../src/controllers/sun');

router.get('/', sunController.list);

module.exports = router;
