// utils/importProcessor.js
const Joi = require('joi');
const moment = require('moment');
const bcrypt = require('bcryptjs');
const { default: readXlsxFile } = require('read-excel-file/node'); // Pastikan ini di-install: npm install read-excel-file
const database = require('#database');
const { sendMail, generateUniqueINV } = require('#utils');
const { BadRequestError } = require('#errors');

async function validateRows(rows) {
  const errors = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 1;
    const email = row[0];
    const password = row[1];
    const paketVal = row?.[2];
    if (!email || !password) {
      errors.push(`Row ${rowNum}, Email dan Password harus diisi`);
      continue;
    }
    if (String(password).length < 8) {
      errors.push(`Row ${rowNum}, Password minimal 8 karakter`);
      continue;
    }
    const emailRegex = /\S+@\S+\.\S+/;
    if (!emailRegex.test(String(email))) {
      errors.push(`Row ${rowNum}, Email tidak valid`);
      continue;
    }
    // Validasi paket jika ada
    if (paketVal) {
      const paketArray = parsePaketIds(paketVal);
      for (const pid of paketArray) {
        const exists = await database.paketPembelian.findUnique({
          where: { id: pid },
          select: { id: true },
        });
        if (!exists) {
          errors.push(`Row ${rowNum}, Paket Pembelian id ${pid} tidak ditemukan`);
        }
      }
    }
  }
  return errors;
}

async function processRow(row) {
  const email = String(row[0]);
  const rawPassword = String(row[1]);
  const paketArray = parsePaketIds(row?.[2]);
  await database.$transaction(async (tx) => {
    // cek user
    const existingUser = await tx.User.findUnique({
      where: { email },
      select: { id: true },
    });
    let userId;
    if (existingUser) {
      // update password saja
      await tx.User.update({
        where: { id: existingUser.id },
        data: { password: bcrypt.hashSync(rawPassword, 10) },
      });
      userId = existingUser.id;
      // hapus semua pembelian lama
      await tx.Pembelian.deleteMany({
        where: { userId },
      });
    } else {
      // buat user baru
      const newUser = await tx.User.create({
        data: {
          email,
          password: bcrypt.hashSync(rawPassword, 10),
        },
        select: { id: true },
      });
      userId = newUser.id;
    }
    // buat pembelian baru
    for (const pid of paketArray) {
      const paket = await tx.paketPembelian.findUnique({
        where: { id: pid },
      });
      if (!paket) continue;
      const expiredAt = paket.durasi
        ? moment().add(paket.durasi * 31, 'days').toDate()
        : null;
      await tx.Pembelian.create({
        data: {
          user: { connect: { id: userId } },
          paketPembelian: { connect: { id: pid } },
          status: 'PAID',
          requirement: null,
          duration: paket.durasi,
          expiredAt,
          namaPaket: paket.nama,
          amount: 0,
          invoice: generateUniqueINV(),
          paymentMethod: 'PENDAFTARAN',
          paidAt: new Date(),
        },
      });
    }
  });
  // kirim email setelah commit
  sendMail({
    to: email,
    subject: 'Selamat Datang di Tuntas CBT UKAI',
    template: 'welcome.html',
    name: email, // Ganti dengan name jika ada kolom name di Excel
    url: `${process.env.URL_CLIENT}`,
    email,
    password: rawPassword,
  });
}

function parsePaketIds(paketVal) {
  if (!paketVal) return [];
  return String(paketVal)
    .split('|')
    .map(v => Number(v))
    .filter(v => !Number.isNaN(v));
}

// Fungsi utama untuk proses job dari queue
async function processImportJob(job) {
  const { rows } = job.data;
  const progress = { total: rows.length, processed: 0, errors: [] };

  try {
    // VALIDATION
    const errors = await validateRows(rows);
    if (errors.length > 0) {
      progress.errors = errors;
      throw new BadRequestError(`Validation errors: ${errors.join('; ')}`);
    }

    // Proses setiap row
    for (const row of rows) {
      try {
        await processRow(row);
        progress.processed++;
        // Update progress di job (jika Bull Queue support)
        await job.progress(progress.processed);
      } catch (rowError) {
        console.error(`Error processing row:`, rowError);
        progress.errors.push(`Row ${progress.processed + 1}: ${rowError.message}`);
        progress.processed++; // Lanjut ke row berikutnya
      }
    }

    if (progress.errors.length > 0) {
      throw new BadRequestError(`Processing errors: ${progress.errors.join('; ')}`);
    }

    return {
      state: 'completed',
      progress: 100,
      result: {
        success: rows.length,
        failed: 0,
        message: `Berhasil import ${rows.length} users`,
      },
    };
  } catch (err) {
    return {
      state: 'failed',
      progress: progress.processed / progress.total * 100,
      result: {
        success: progress.processed,
        failed: progress.errors.length,
        errors: progress.errors,
        message: err.message,
      },
    };
  }
}

module.exports = { processImportJob, validateRows, processRow, parsePaketIds };