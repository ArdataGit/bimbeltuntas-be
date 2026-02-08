const express = require('express');

const router = express.Router();

const {
  register,
  login,
  forgotPassword,
  confirmEmail,
  resetPassword,
} = require('./controller');

router.post('/register', register);
router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.get('/confirm-email/:token', confirmEmail);
router.post('/reset-password/', resetPassword);
module.exports = router;
