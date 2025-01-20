const express = require('express');

const router = express.Router();

const {
  update,
  remove,
  getSubCategory,
  insert,
  excel,
  importExcel,
  importExcelTest,
} = require('./controller');
const { upload } = require('#utils');

router.get('/get-subcategory', getSubCategory);
router.post('/insert', insert);
router.patch('/update/:id', update);
router.delete('/remove/:id', remove);
router.get('/export/:id', excel);
router.post('/import/:id', upload('excel').single('file'), importExcel);
router.post('/import-test', upload('excel').single('file'), importExcelTest);

module.exports = router;
