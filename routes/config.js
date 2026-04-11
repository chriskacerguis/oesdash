const router = require('express').Router();
const configController = require('../src/controllers/config');

router.get('/', configController.get);

module.exports = router;
