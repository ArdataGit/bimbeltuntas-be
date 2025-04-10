const Joi = require('joi');
const moment = require('moment');
const bcrypt = require('bcryptjs');
const excelJS = require('exceljs');
const { default: readXlsxFile } = require('read-excel-file/node');
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
        email: Joi.string().allow('').optional(), // Tambahkan validasi untuk email
        name: Joi.string().allow('').optional(), // Tambahkan validasi untuk name
        hasPurchase: Joi.boolean().optional(), // Validasi untuk hasPurchase
        packageId: Joi.number().integer().optional(), // Validasi untuk packageId
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

const importExcel = async (req, res, next) => {
  try {
    const exFile = `${__dirname}/../../../${req.file.path}`;
    const error = [];

    const rows = await readXlsxFile(fs.createReadStream(exFile));
    rows.shift(); // Menghapus header jika ada

    // Menggunakan map untuk melakukan async operation pada setiap row dan Promise.all untuk menunggu semua selesai
    await Promise.all(
      rows.map(async (row, index) => {
        if (!row[0] || !row[1]) {
          return error.push(`Row ${index + 1}, Email dan Password harus diisi`);
        }

        if (row[1].length < 8) {
          return error.push(`Row ${index + 1}, Password minimal 8 karakter`);
        }

        // check if email is valid
        const emailRegex = /\S+@\S+\.\S+/;
        if (!emailRegex.test(row[0])) {
          return error.push(`Row ${index + 1}, Email tidak valid`);
        }

        const isEmailExist = await database.User.findMany({
          where: {
            email: row[0],
          },
        });

        if (isEmailExist?.length > 0) {
          return error.push(
            `Row ${index + 1},  Email Telah digunakan (${row[0]})`
          );
        }

        if (row?.[2]) {
          const val = String(row?.[2]);
          const array = val.includes('|')
            ? val.split('|').map(Number)
            : [Number(val)];

          await Promise.all(
            array.map(async (id) => {
              const checkingPaket = await database.paketPembelian.findUnique({
                where: {
                  id,
                },
              });

              if (!checkingPaket) {
                error.push(
                  `Row ${
                    index + 1
                  }, Paket Pembelian dengan id ${id} tidak ditemukan`
                );
              }
            })
          );
        }
      })
    );

    if (error.length > 0) {
      return res.status(400).json({
        error,
        msg: 'Gagal import data',
      });
    }

    await Promise.all(
      rows.map(async (row) => {
        // Contoh operasi pembuatan user
        const user = await database.User.create({
          data: {
            email: row[0],
            password: bcrypt.hashSync(row[1], 10),
          },
        });

        if (row?.[2]) {
          const val = String(row?.[2]);
          const array = val.includes('|')
            ? val.split('|').map(Number)
            : [Number(val)];

          await Promise.all(
            array.map(async (id) => {
              const getPaket = await database.paketPembelian.findUnique({
                where: {
                  id,
                },
              });

              await database.pembelian.create({
                data: {
                  user: { connect: { id: user.id } }, // Assuming you want to associate the purchase with a user
                  paketPembelian: { connect: { id } },
                  status: 'PAID',
                  requirement: null,
                  duration: getPaket.durasi,
                  expiredAt: getPaket.durasi
                    ? moment()
                        .add(getPaket.durasi * 31, 'days')
                        .toDate()
                    : null,
                  namaPaket: getPaket.nama,
                  amount: 0,
                  invoice: generateUniqueINV(),
                  paymentMethod: 'PENDAFTARAN',
                  paidAt: new Date(),
                },
              });
            })
          );
        }

        sendMail({
          to: user.email,
          subject: 'Selamat Datang di Tuntas CBT UKAI',
          template: 'welcome.html',
          name: row[0],
          url: `${process.env.URL_CLIENT}`,
          email: row[0],
          password: row[1],
        });
      })
    );

    res.status(200).json({
      data: null,
      msg: 'User created',
    });
  } catch (error) {
    next(error);
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
