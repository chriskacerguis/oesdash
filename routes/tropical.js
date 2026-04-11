const router = require('express').Router();
const tropicalController = require('../src/controllers/tropical');

router.get('/', tropicalController.list);

module.exports = router;
