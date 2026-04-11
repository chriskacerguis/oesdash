const router = require('express').Router();
const emissionsController = require('../src/controllers/emissions');

router.get('/', emissionsController.list);

module.exports = router;
