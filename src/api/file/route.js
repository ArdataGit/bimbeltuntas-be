const express = require("express");

const router = express.Router();

const fs = require("fs");
const pdf = require("pdf-creator-node");
const { convert } = require("html-to-text");
const moment = require("moment");

const path = require("path");

const { uploadFile } = require("./controller");
const { upload } = require("#utils");
const database = require("#database");

// var pdf = require('pdf-creator-node');
// var fs = require('fs');

// // Read HTML Template

const getIndexAnswer = (jawabanSelect, jawaban) => {
  const jwb = JSON.parse(jawaban);
  const index = jwb.findIndex((item) => item.id === jawabanSelect);
  return String.fromCharCode(65 + index) || "-";
};

const getIndexSelectedAnswer = (jawaban) => {
  const jwb = JSON.parse(jawaban);
  const index = jwb.findIndex((item) => item.isCorrect);
  return String.fromCharCode(65 + index) || "-";
};

router.post("/upload", upload("file").single("upload"), uploadFile);
router.get("/generate-pdf/:id", async (req, res) => {
  const tryoutId = Number(req.params.id);
  console.log("PATH MODULE:", path);

  try {
    // Ambil data Tryout + relasi ke PaketLatihan
    const tryout = await database.tryout.findUnique({
      where: { id: tryoutId },
      include: {
        paketLatihan: true, // relasi yang benar
      },
    });

    if (!tryout) {
      return res.status(404).json({ message: "Tryout tidak ditemukan" });
    }

    const pdfPath = tryout.paketLatihan?.pdf;

    if (!pdfPath) {
      return res.status(404).json({
        message: "File PDF tidak tersedia untuk paket latihan ini.",
      });
    }

    // Jawab path-nya saja
    return res.json({
      message: "Path file PDF ditemukan",
      pdfPath,
      fileExists: fs.existsSync(pdfPath),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Gagal mengambil path PDF",
      error: error.message,
    });
  }
});

module.exports = router;
