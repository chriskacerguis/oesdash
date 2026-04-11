const router = require('express').Router();
const spcController = require('../src/controllers/spc');

router.get('/', spcController.list);

module.exports = router;
