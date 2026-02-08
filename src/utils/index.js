const email = require('./email');
const deleteFile = require('./delete-file');
const jwt = require('./jwt');
const multer = require('./multer');
const filterToJson = require('./filter-to-json');
const returnPagination = require('./return-pagination');
const generateUniqueINV = require('./generate-invoice');
const database = require('#database');

const getBankSoal = async (data, tryoutId, isRandom) => {
  const idSet = new Set();
  const catMaxPoint = {};

  const totalMaxPoint = async (bankSoal) => {
    if (catMaxPoint[bankSoal.category.id] === undefined) {
      const result = await database.bankSoalJawaban.aggregate({
        where: {
          bankSoal: {
            categoryId: bankSoal.category.id,
          },
          isCorrect: true,
        },
        _sum: {
          point: true,
        },
      });

      catMaxPoint[bankSoal.category.id] = result?._sum.point;
    }

    return catMaxPoint[bankSoal.category.id];
  };

  // console.log(isRandom, 9999999);
  // sortSoal      Int           @default(0)
  // sortCategory  Int           @default(0)
  let sortCategory = 1;
  let sortSoal = 1;
  for (const userData of data) {
    console.log(userData);
    if (userData.bankSoalCategory && userData.bankSoalCategory.BankSoal) {
      for (const bankSoal of userData.bankSoalCategory.BankSoal) {
        idSet.add({
          soalId: bankSoal.id,
          soal: bankSoal.soal,
          pembahasan: bankSoal.pembahasan,
          category: bankSoal.category.nama,
          categoryKet: bankSoal.category.keterangan,
          jawabanShow: JSON.stringify(
            bankSoal.BankSoalJawaban.map((jawaban) => ({
              id: jawaban.id,
              jawaban: jawaban.jawaban,
            }))
          ),
          sortCategory,
          sortSoal: userData.isRandomQuestion
            ? Math.floor(Math.random() * 100)
            : sortSoal,
          kkm: bankSoal.category.kkm,
          maxPoint: await totalMaxPoint(bankSoal),
          tryoutId,
          jawaban: JSON.stringify(bankSoal.BankSoalJawaban),
          subCategory: bankSoal.subCategory,
          tipePenilaian: bankSoal.category.tipePenilaian,
        });
      }
    }
    sortCategory += 1;
    sortSoal += 1;
  }

  return Array.from(idSet);
};

function countAllMaxPoint(questions) {
  let maxPoints = 0;

  // Iterasi melalui setiap pertanyaan
  questions.forEach((category) => {
    category.bankSoalCategory.BankSoal.forEach((question) => {
      // Iterasi melalui setiap jawaban
      question.BankSoalJawaban.forEach((answer) => {
        // Jika jawaban benar, tambahkan point ke maxPoints
        if (answer.isCorrect) {
          maxPoints += answer.point;
        }
      });
    });
  });

  return maxPoints;
}
function countAllPoint(data) {
  const totalPoin = data.reduce((acc, soal) => acc + soal.point, 0);
  return totalPoin;
}

// Fungsi untuk menghitung jumlah poin berdasarkan kategori
function countAllPointByCat(data) {
  const totalPoinByKategori = {};

  data.forEach((soal) => {
    const kategori = soal.category.trim(); // Menghapus spasi pada awal dan akhir kategori
    if (totalPoinByKategori[kategori] === undefined) {
      totalPoinByKategori[kategori] = {
        value: 0,
        kkm: soal.kkm,
      };
    }
    totalPoinByKategori[kategori].value += soal.point;
  });

  return totalPoinByKategori;
}

const queryGetNilaiByCat = async (id, userId) => {
  const result =
    await database.$queryRaw`SELECT ts.category, ts.kkm, ts.maxPoint, COALESCE(SUM(ts.point), 0) AS all_point FROM Tryout t LEFT JOIN TryoutSoal ts ON t.id = ts.tryoutId WHERE t.id = ${id} AND t.userId = ${userId} GROUP BY ts.category, ts.kkm, ts.maxPoint ORDER BY all_point DESC;`;

  return result;
};

const konversiDetikKeWaktu = (detik) => {
  if (!detik) return '00:00';
  // Menghitung jam, menit, dan detik
  let jam = Math.floor(detik / 3600).toString();
  const sisaDetik = detik % 3600;
  let menit = Math.floor(sisaDetik / 60).toString();
  let detikSisa = Number(sisaDetik % 60).toString();

  // Menambahkan "0" di depan angka jika kurang dari 10
  jam = jam.length < 2 ? `0${jam}` : jam;
  menit = menit.length < 2 ? `0${menit}` : menit.toString();
  detikSisa = detikSisa.length < 2 ? `0${detikSisa}` : detikSisa.toString();

  // Membuat format waktu
  let formatWaktu = '';
  if (jam > '0') {
    formatWaktu += jam + ':';
  }
  formatWaktu += menit + ':' + detikSisa;

  return formatWaktu;
};

module.exports = {
  sendMail: email,
  generateToken: jwt.generateToken,
  isTokenValid: jwt.isTokenValid,
  upload: multer.upload,
  multiple: multer.multiple,
  deleteFile,
  jwt,
  countAllMaxPoint,
  multer,
  returnPagination,
  filterToJson,
  generateUniqueINV,
  getBankSoal,
  countAllPoint,
  countAllPointByCat,
  queryGetNilaiByCat,
  konversiDetikKeWaktu,
};
