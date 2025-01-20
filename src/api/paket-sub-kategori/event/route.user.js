const express = require('express');

const router = express.Router();

const { get, find } = require('./controller');

router.get('/get', get);
router.get('/find/:id', find);

module.exports = router;
