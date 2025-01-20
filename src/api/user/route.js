const express = require('express');

const router = express.Router();

const {
  checkVoucher,
  getMyClass,
  getVoucherAlumni,
  findMyClass,
  findLatihan,
  findTryout,
  changeProfile,
  findSoalTryout,
  getAllCategory,
  changePassword,
} = require('./controller');
const { upload } = require('#utils');

router.post('/check-voucher', checkVoucher);
router.get('/get-my-class', getMyClass);
router.get('/find-my-class/:id', findMyClass);
router.get('/get-voucher-alumni', getVoucherAlumni);
router.get('/find-latihan/:id', findLatihan);
router.get('/find-tryout/:id', findTryout);
router.get('/category/get', getAllCategory);
router.get('/find-soal-tryout/:id', findSoalTryout);
router.post(
  '/change-profile',
  upload('avatar').single('gambar'),
  changeProfile
);
router.post('/change-password', changePassword);

module.exports = router;
