const express = require('express');

const router = express.Router();

const { get, insert, remove } = require('./controller');

router.get('/get', get);
router.post('/insert', insert);
router.delete('/remove/:id', remove);

module.exports = router;
