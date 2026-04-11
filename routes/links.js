const router = require('express').Router();
const linksController = require('../src/controllers/links');

router.get('/', linksController.list);

module.exports = router;
