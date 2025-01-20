const express = require('express');

const router = express.Router();

const { read, readAll } = require('./controller');

router.post('/read', read);
router.post('/read-all', readAll);

module.exports = router;
