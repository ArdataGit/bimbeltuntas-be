const Joi = require('joi');
const moment = require('moment');
const bcrypt = require('bcryptjs');
const excelJS = require('exceljs');
const { default: readXlsxFile } = require('read-excel-file/node');
const importExcelQueue = require('../../queues/importExcelQueue');
const fs = require('fs');
const database = require('#database');
const {
  returnPagination,
  filterToJson,
  sendMail,
  generateUniqueINV,
} = require('#utils');
const { BadRequestError } = require('#errors');

const get = async (req, res, next) => {
  try {
    const schema = Joi.object({
      skip: Joi.number(),
      take: Joi.number(),
      sortBy: Joi.string().allow(''),
      descending: Joi.boolean(),
      filters: Joi.object({
        email: Joi.string().allow('').optional(),
        name: Joi.string().allow('').optional(),
        hasPurchase: Joi.boolean().optional(),
        packageId: Joi.number().integer().optional(),
      }).optional(),
    });
    const validate = await schema.validateAsync(req.query);
    const result = await database.$transaction([
      database.User.findMany({
        skip: validate.skip,
        take: validate.take,
        where: filterToJson(validate),
        orderBy: {
          [validate.sortBy]: validate.descending ? 'desc' : 'asc',
        },
        include: {
          Pembelian: {
            include: {
              paketPembelian: true,
            },
          },
        },
      }),
      database.User.count({
        where: filterToJson(validate),
      }),
    ]);
    return returnPagination(req, res, result);
  } catch (error) {
    next(error);
  }
};

const excel = async (req, res, next) => {
  try {
    const workbook = new excelJS.Workbook();
    const worksheet = workbook.addWorksheet('Users');
    const User = await database.User.findMany({});
    worksheet.columns = [
      { header: 'Nama Lengkap', key: 'name', width: 15 },
      { header: 'Email', key: 'email', width: 15 },
      { header: 'Nomor Telepon', key: 'noWA', width: 15 },
      { header: 'Alamat', key: 'alamat', width: 15 },
      { header: 'Provinsi', key: 'provinsi', width: 15 },
      { header: 'Kabupaten', key: 'kabupaten', width: 15 },
      { header: 'Kecamatan', key: 'kecamatan', width: 15 },
      { header: 'Role', key: 'role', width: 10 },
      { header: 'Tanggal Bergabung', key: 'createdAt', width: 25 },
    ];
    User.forEach((user) => {
      worksheet.addRow({
        ...user,
        createdAt: moment(user.createdAt).format('DD-MM-YYYY HH:mm'),
      });
    });
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', 'attachment; filename=users.xlsx');
    workbook.xlsx.write(res).then(() => res.end());
  } catch (error) {
    next(error);
  }
};

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
    name: email,
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

const path = require("path");
const os = require("os");

const importExcel = async (req, res, next) => {
  try {
    const filePath = `${__dirname}/../../../${req.file.path}`;

    // BACA FILE DULU UNTUK HITUNG ROW
    const rows = await readXlsxFile(fs.createReadStream(filePath));
    rows.shift(); // hapus header

    const totalRows = rows.length;

    // MASUKKAN KE QUEUE
    const job = await importExcelQueue.add("import", {
      filePath
    });

    return res.status(200).json({
      msg: "File berhasil diupload, proses import berjalan di background",
      jobId: job.id,
      totalRows
    });

  } catch (err) {
    next(err);
  }
};


const find = async (req, res, next) => {
  try {
    const schema = Joi.object({
      id: Joi.number().required(),
    });
    const validate = await schema.validateAsync(req.params);
    const result = await database.User.findUnique({
      where: {
        id: validate.id,
      },
    });
    if (!result) throw new BadRequestError('User dengan tidak ditemukan');
    res.status(200).json({
      data: result,
      msg: 'Get data by id',
    });
  } catch (error) {
    next(error);
  }
};

const insert = async (req, res, next) => {
  try {
    const schema = Joi.object({
      name: Joi.string().required(),
      email: Joi.string().email().required(),
      password: Joi.string().required().min(8),
      noWA: Joi.string().allow(''),
      jenisKelamin: Joi.string().allow(''),
      alamat: Joi.string().allow(''),
      provinsi: Joi.string().allow(''),
      kabupaten: Joi.string().allow(''),
      kecamatan: Joi.string().allow(''),
    }).unknown();
    const validate = await schema.validateAsync(req.body);
    const isEmailExist = await database.User.findUnique({
      where: {
        email: validate.email,
      },
    });
    if (isEmailExist) throw new BadRequestError('Email telah digunakan');
    const result = await database.User.create({
      data: {
        ...validate,
        verifyAt: new Date(),
        password: bcrypt.hashSync(validate.password, 10),
      },
    });
    sendMail({
      to: validate.email,
      subject: 'Selamat Datang di Tuntas CBT UKAI',
      template: 'welcome.html',
      name: validate.name,
      url: `${process.env.URL_CLIENT}`,
      email: validate.email,
      password: validate.password,
    });
    res.status(201).json({
      data: result,
      msg: 'Create data',
    });
  } catch (error) {
    next(error);
  }
};

const update = async (req, res, next) => {
  try {
    const schema = Joi.object({
      id: Joi.number().required(),
      name: Joi.string().required(),
      noWA: Joi.string().allow(''),
      jenisKelamin: Joi.string().allow(''),
      alamat: Joi.string().allow(''),
      provinsi: Joi.string().allow(''),
      kabupaten: Joi.string().allow(''),
      kecamatan: Joi.string().allow(''),
      password: Joi.string().min(8).allow(''),
      email: Joi.string().email(),
    }).unknown();
    const validate = await schema.validateAsync({
      ...req.params,
      ...req.body,
    });
    const isExist = await database.User.findUnique({
      where: {
        id: validate.id,
      },
    });
    if (validate.email && validate.email !== isExist.email) {
      const isEmailExist = await database.User.findUnique({
        where: {
          email: validate.email,
        },
      });
      if (isEmailExist) throw new BadRequestError('Email telah digunakan');
    }
    if (validate.password) {
      validate.password = bcrypt.hashSync(validate.password, 10);
    } else {
      delete validate.password;
    }
    if (!isExist) throw new BadRequestError('User tidak ditemukan');
    delete validate.Pembelian;
    const payload = validate;
    delete payload.id;
    delete payload.key;
    delete payload.rowIndex;
    // delete payload.createdAt;
    const result = await database.User.update({
      where: {
        id: isExist.id,
      },
      data: payload,
    });
    res.status(200).json({
      data: result,
      msg: 'Berhasil mengubah data user',
    });
  } catch (error) {
    next(error);
  }
};

const remove = async (req, res, next) => {
  try {
    const schema = Joi.object({
      ids: Joi.array().items(Joi.number()).required(),
    });
    const validate = await schema.validateAsync(req.body);
    const result = await database.User.deleteMany({
      where: {
        id: {
          in: validate.ids,
        },
      },
    });
    res.status(200).json({
      data: result,
      msg: 'Berhasil menghapus data user',
    });
  } catch (error) {
    next(error);
  }
};

const getPaketPembelian = async (req, res, next) => {
  try {
    const paketList = await database.paketPembelian.findMany({
      where: {
        isActive: true, // Hanya paket aktif
      },
      select: {
        id: true,
        nama: true, // Nama paket
      },
    });
    res.status(200).json({
      data: paketList,
      msg: 'Berhasil mengambil data paket',
    });
  } catch (error) {
    next(error);
  }
};

const deleteUsersWithoutPurchases = async (req, res, next) => {
  try {
    // Hapus user tanpa pembelian
    const deletedUsers = await database.User.deleteMany({
      where: {
        Pembelian: {
          none: {}, // Hapus user yang tidak memiliki pembelian
        },
      },
    });
    res.status(200).json({
      message: `${deletedUsers.count} user(s) tanpa pembelian berhasil dihapus`,
    });
  } catch (error) {
    next(error);
  }
};

const deleteFilteredUsers = async (req, res, next) => {
  try {
    const { filters } = req.body; // Terima filter dari frontend
    // Bangun query `where` berdasarkan filter
    const whereClause = filterToJson({ filters });
    // Hapus data yang sesuai dengan filter
    const deletedUsers = await database.User.deleteMany({
      where: whereClause,
    });
    res.status(200).json({
      message: `${deletedUsers.count} user(s) berhasil dihapus`,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
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
};