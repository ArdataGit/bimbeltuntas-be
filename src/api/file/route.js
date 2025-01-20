const express = require('express');

const router = express.Router();

const fs = require('fs');
const pdf = require('pdf-creator-node');
const { convert } = require('html-to-text');
const moment = require('moment');

const { uploadFile } = require('./controller');
const { upload } = require('#utils');
const database = require('#database');

// var pdf = require('pdf-creator-node');
// var fs = require('fs');

// // Read HTML Template

const getIndexAnswer = (jawabanSelect, jawaban) => {
  const jwb = JSON.parse(jawaban);
  const index = jwb.findIndex((item) => item.id === jawabanSelect);
  return String.fromCharCode(65 + index) || '-';
};

const getIndexSelectedAnswer = (jawaban) => {
  const jwb = JSON.parse(jawaban);
  const index = jwb.findIndex((item) => item.isCorrect);
  return String.fromCharCode(65 + index) || '-';
};

router.post('/upload', upload('file').single('upload'), uploadFile);
router.get('/generate-pdf/:id', async (req, res) => {
  const tryoutId = req.params.id;

  const getAllSoalId = await database.tryoutSoal.findMany({
    where: {
      tryoutId: Number(tryoutId),
    },
    orderBy: [
      {
        sortCategory: 'asc',
      },
      {
        sortSoal: 'asc',
      },
    ],
  });

 const html = fs.readFileSync('./test.html', 'utf8');


  const options = {
    format: 'A3',
    orientation: 'portrait',
    border: '10mm',
    // header: {
    // height: '45mm',
    // contents: '<div style="text-align: center;">Author: Shyam Hajare</div>',
    // },
    // footer: {
    //   height: '28mm',
    //   contents: {
    //     first: 'Cover page',
    //     2: 'Second page', // Any page number is working. 1-based index
    //     default:
    //       '<span style="color: #444;">{{page}}</span>/<span>{{pages}}</span>', // fallback value
    //     last: 'Last Page',
    //   },
    // },
  };

  const data = getAllSoalId.map((item, index) => {
    const AnswerSelected = getIndexAnswer(item.jawabanSelect, item.jawaban);
    const AnswerCorrect = getIndexSelectedAnswer(item.jawaban);

    const jwb = JSON.parse(item.jawaban)?.map((j, i) => ({
      jawaban: convert(j.jawaban),
      option: String.fromCharCode(65 + i),
      // AnswerSelected,
      // AnswerCorrect,
      isSelected: String.fromCharCode(65 + i) === AnswerSelected,
      isCorrect: String.fromCharCode(65 + i) === AnswerCorrect,
    }));

    return {
      ...item,
      // jawabanSelect: item.jawabanSelect ? item.jawabanSelect : '-',
      jawaban: jwb,
      no: index + 1,
      isRaguRagu: item.isRaguRagu ? 'Ya' : 'Tidak',
      soal: convert(item.soal),
      pembahasan: convert(item.pembahasan),
    };
  });

  const file = {
    html,
    data: {
      data,
      title: `Tryout ${moment().format('DD-MM-YYYY')}`,
    },
    path: './output.pdf',
    type: '',
  };

  pdf
    .create(file, options)
    .then((result) => {
      return res.sendFile(result.filename);
    })
    .catch((error) => {
      console.error(error);
    });

  // return res.send('generate-pdf');
});

module.exports = router;
