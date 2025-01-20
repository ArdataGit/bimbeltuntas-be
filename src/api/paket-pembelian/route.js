const express = require('express');

const router = express.Router();

const { get, find, insert, update, remove } = require('./controller');
const { upload } = require('#utils');

router.get('/get', get);
router.get('/find/:id', find);
router.post('/insert', upload('paket-pembelian').single('gambar'), insert);
router.patch('/update/:id', upload('paket-pembelian').single('gambar'), update);
router.delete('/remove/:id', remove);

module.exports = router;
