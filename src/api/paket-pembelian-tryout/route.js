const express = require('express');

const router = express.Router();

const {
  get,
  insert,
  update,
  remove,
  excel,
  getHistory,
  excelTryout,
  find,
} = require('./controller');

router.get('/get', get);
router.get('/find/:id', find);
router.post('/insert', insert);
router.patch('/update/:id', update);
router.delete('/remove/:id', remove);
router.get('/excel', excel);
router.get('/excel-tryout', excelTryout);
router.get('/get-history', getHistory);
module.exports = router;
