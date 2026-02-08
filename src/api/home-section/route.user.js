const express = require('express');

const router = express.Router();

const { get } = require('./controller');

router.get('/get', get);

module.exports = router;
