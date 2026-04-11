const router = require('express').Router();
const floodsController = require('../src/controllers/floods');

router.get('/', floodsController.list);

module.exports = router;
