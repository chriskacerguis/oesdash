const router = require('express').Router();
const hfpropController = require('../src/controllers/hfprop');

router.get('/', hfpropController.list);

module.exports = router;
