const express = require('express');

const router = express.Router();

const { get, find } = require('./controller');
const { getCategory } = require('../paket-pembelian-materi/controller');

router.get('/get', get);
router.get('/get-category', getCategory);
router.get('/find/:id', find);

module.exports = router;
