const express = require('express');

const router = express.Router();

const {
  get,
  find,
  insert,
  update,
  remove,
  excel,
  importExcel,
  getPaketPembelian,
  deleteUsersWithoutPurchases,
  deleteFilteredUsers,
} = require('./controller');
const { upload } = require('#utils');

router.get('/get', get);
router.get('/find/:id', find);
router.post('/insert', insert);
router.patch('/update/:id', update);
router.post('/remove', remove);
router.get('/excel', excel);
router.post('/import', upload('excel').single('file'), importExcel);
router.get('/packages/get', getPaketPembelian);
router.delete('/delete-no-purchases', deleteUsersWithoutPurchases);
router.delete('/delete-filtered', deleteFilteredUsers);

module.exports = router;
