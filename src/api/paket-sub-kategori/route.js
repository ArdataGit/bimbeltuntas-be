const express = require('express');

const router = express.Router();

const { get, insert, update, remove } = require('./controller');

router.post('/insert', insert);
router.get('/get', get);
router.patch('/update/:id', update);
router.delete('/remove/:id', remove);

module.exports = router;
