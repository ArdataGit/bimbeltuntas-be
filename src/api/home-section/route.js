const express = require('express');

const router = express.Router();

const { upload } = require('#utils');

const { get, insert, update, remove } = require('./controller');

router.get('/get', get);
router.post('/insert', upload('section').single('gambar'), insert);
router.patch('/update/:id', upload('section').single('gambar'), update);
router.delete('/remove/:id', remove);

module.exports = router;
