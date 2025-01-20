const express = require('express');

const router = express.Router();

const {
  get,
  find,
  getPenjualan,
  insert,
  update,
  remove,
  finishPayment,
} = require('./controller');
const { upload } = require('#utils');

router.get('/get', get);
router.get('/penjualan', getPenjualan);
router.get('/find/:id', find);
router.post('/insert', upload('banner-latihan').single('banner'), insert);
router.patch('/update/:id', upload('banner-latihan').single('banner'), update);
router.delete('/remove/:id', remove);

router.post('/penjualan/finish-payment', finishPayment);
module.exports = router;
