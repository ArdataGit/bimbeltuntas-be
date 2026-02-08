const express = require('express');

const router = express.Router();

const {
  start,
  answer,
  finish,
  history,
  getMyTryout,
  ranking,
  statistic,
  checkActive,
  addDuration,
  markAsIsRaguRagu,
} = require('./controller');

router.post('/start', start);
router.post('/answer', answer);
router.post('/mark-ragu', markAsIsRaguRagu);
router.post('/finish', finish);
router.get('/history', history);
router.get('/my-tryout', getMyTryout);
router.get('/ranking', ranking);
router.get('/statistic', statistic);
router.get('/check-active', checkActive);
router.post('/add-duration', addDuration);
module.exports = router;
