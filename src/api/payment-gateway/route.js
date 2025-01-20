const express = require('express');

const router = express.Router();

const {
  getMerchantList,
  createPayment,
  callbackPayment,
  get,
  getFeeMerchant,
} = require('./controller');
const { authenticateUser } = require('#middlewares');

router.get('/merchant-list', authenticateUser, getMerchantList);
router.get('/get', authenticateUser, get);
router.post('/create-payment', authenticateUser, createPayment);

router.post('/callback-payment', callbackPayment);
router.get('/payment-fee', authenticateUser, getFeeMerchant);

module.exports = router;
