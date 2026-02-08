const express = require('express');

const router = express.Router();

const {
  get,
  find,
  insert,
  update,
  remove,
  getCategory,
} = require('./controller');

router.get('/get', get);
router.get('/find/:id', find);
router.get('/get-category', getCategory);
router.post('/insert', insert);
router.patch('/update/:id', update);
router.delete('/remove/:id', remove);

module.exports = router;
