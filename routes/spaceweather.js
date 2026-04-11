const router = require('express').Router();
const spaceweatherController = require('../src/controllers/spaceweather');

router.get('/', spaceweatherController.list);

module.exports = router;
