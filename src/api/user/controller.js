const Joi = require('joi');
const bcrypt = require('bcryptjs');
const moment = require('moment');
const database = require('#database');
const { BadRequestError } = require('#errors');
const { returnPagination, generateToken, deleteFile } = require('#utils');

const changeProfile = async (req, res, next) => {
  try {
    const schema = Joi.object({
      name: Joi.string().required(),
      email: Joi.string().email().required(),
      noWA: Joi.string().required(),
      alamat: Joi.string().required(),
      provinsi: Joi.string().required(),
      kabupaten: Joi.string().required(),
      kecamatan: Joi.string().required(),
      gambar: Joi.string(),
    }).unknown(true);

    const validate = await schema.validateAsync({
      ...req.body,
      gambar: req.file?.path,
    });

    const isExist = await database.user.findUnique({
      where: {
        id: req?.user?.id,
      },
    });

    if (!isExist) throw new BadRequestError('User tidak ditemukan');

    if (req?.file?.path && isExist.gambar !== 'public/DEFAULT_USER.png') {
      deleteFile(isExist.banner);
    }

    const result = await database.user.update({
      where: {
        id: req?.user?.id,
      },
      data: {
        name: validate.name,
        noWA: validate.noWA,
        alamat: validate.alamat,
        provinsi: validate.provinsi,
        kabupaten: validate.kabupaten,
        kecamatan: validate.kecamatan,
        gambar: validate.gambar || isExist.gambar,
      },
    });

    const token = generateToken(result);

    res.status(200).json({
      data: {
        token,
        user: result,
      },

      msg: 'Berhasil mengubah profile',
    });
  } catch (error) {
    next(error);
  }
};
const checkVoucher = async (req, res, next) => {
  try {
    const schema = Joi.object({
      code: Joi.string().required(),
      paketId: Joi.number().required(),
    });

    const validate = await schema.validateAsync(req.body);

    const result = await database.voucher.findFirst({
      where: {
        kode: validate.code,
        status: 'AKTIF',
        deletedAt: null,
      },
    });

    if (!result) throw new BadRequestError('Voucher tidak ditemukan');

    const checkSpesificProduct = await database.voucherProduct.findMany({
      where: {
        voucherId: result.id,
      },
    });

    if (checkSpesificProduct.length > 0) {
      const checkProduct = checkSpesificProduct.find(
        (e) => e.paketId === validate.paketId
      );
      if (!checkProduct)
        throw new BadRequestError(
          'Voucher tidak bisa digunakan untuk produk ini'
        );
    }

    res.status(200).json({
      data: result,
      msg: 'Berhasil menggunakan voucher',
    });
  } catch (error) {
    next(error);
  }
};

const getVoucherAlumni = async (req, res, next) => {
  let result;

  const checkPembelian = await database.pembelian.findMany({
    where: {
      userId: req?.user?.id,
      status: 'PAID',
    },
  });

  if (checkPembelian.length > 0) {
    result = await database.voucher.findFirst({
      where: {
        tipe: 'ALUMNI',
        status: 'AKTIF',
        deletedAt: null,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  try {
    return res.status(200).json({
      data: result,
      msg: 'Get data success',
    });
  } catch (error) {
    next(error);
  }
};
const findMyClass = async (req, res, next) => {
  try {
    const schema = Joi.object({
      id: Joi.number().required(),
    });

    const validate = await schema.validateAsync(req.params);

    const result = await database.pembelian.findFirst({
      where: {
        paketPembelianId: validate.id,
        status: 'PAID',
        userId: req?.user?.id,
        OR: [
          {
            expiredAt: null, // Tampilkan jika expiredAt tidak ada
          },
          {
            expiredAt: {
              gt: new Date(),
            },
          },
        ],
      },
      include: {
        paketPembelian: {
          include: {
            paketPembelianBimbel: {
              include: {
                paketLatihan: {
                  select: {
                    id: true,
                    waktu: true,
                    nama: true,
                    PaketLatihanSoal: {
                      select: {
                        id: true,
                        bankSoalCategory: {
                          select: {
                            _count: {
                              select: {
                                BankSoal: true,
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
            paketPembelianFitur: true,
            paketPembelianMateri: true,
            paketPembelianTryout: {
              include: {
                PaketLatihan: {
                  select: {
                    id: true,
                    waktu: true,
                    startAt: true,
                    endAt: true,
                    nama: true,
                    PaketLatihanSoal: {
                      select: {
                        id: true,
                        bankSoalCategory: {
                          select: {
                            _count: {
                              select: {
                                BankSoal: true,
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
                Tryout: {
                  select: {
                    id: true,
                  },
                  where: {
                    userId: req?.user?.id,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!result) throw new BadRequestError('Data tidak ditemukan');
    return res.status(200).json({
      data: result,
      msg: 'Get data success',
    });
  } catch (error) {
    next(error);
  }
};

const getMyClass = async (req, res, next) => {
  try {
    const result = await database.$transaction([
      database.pembelian.findMany({
        where: {
          userId: req?.user?.id,
          status: 'PAID',
          paketPembelianId: {
            not: null,
          },
          // expiredAt: {
          //   gt: new Date()
          // },
          OR: [
            {
              expiredAt: null, // Tampilkan jika expiredAt tidak ada
            },
            {
              expiredAt: {
                gt: new Date(),
              },
            },
          ],
        },
        include: {
          paketPembelian: {
            select: {
              nama: true,
              harga: true,
              id: true,
              keterangan: true,
              durasi: true,
              gambar: true,
              paketPembelianFitur: true,
              _count: {
                select: {
                  paketPembelianMateri: true,
                  paketPembelianTryout: true,
                  paketPembelianBimbel: true,
                },
              },
            },
          },
        },
      }),
      database.pembelian.count({
        where: {
          userId: req?.user?.id,
          status: 'PAID',
        },
      }),
    ]);

    return returnPagination(req, res, result);
  } catch (error) {
    next(error);
  }
};
const findLatihan = async (req, res, next) => {
  try {
    const schema = Joi.object({
      id: Joi.number().required(),
      tryoutId: Joi.number().allow(null, '').optional(),
    });
    const validate = await schema.validateAsync({
      ...req.params,
      ...req.query,
    });
    const result = await database.paketLatihan.findUnique({
      where: {
        id: validate.id,
      },
      select: {
        id: true,
        nama: true,
        waktu: true,
        kkm: true,
        PaketLatihanSoal: {
          select: {
            bankSoalCategory: {
              select: {
                nama: true,
                kkm: true,
                _count: {
                  select: {
                    BankSoal: true,
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!result) throw new BadRequestError('Paket Latihan tidak ditemukan');

    if (validate.tryoutId) {
      const paketPembelianTryout =
        await database.paketPembelianTryout.findFirst({
          where: {
            paketLatihanId: validate.id,
          },
        });
      result.limit = paketPembelianTryout.limit;
      result.startDate = paketPembelianTryout.startDate;
      result.endDate = paketPembelianTryout.endDate;

      const checkMyLimitTryout = await database.tryout.count({
        where: {
          userId: req.user.id,
          paketPembelianTryoutId: validate.tryoutId,
        },
      });

      result.myLimit = checkMyLimitTryout;
    }
    res.status(200).json({
      data: result,
      msg: 'Get data by id',
    });
  } catch (error) {
    next(error);
  }
};
const findTryout = async (req, res, next) => {
  try {
    const schema = Joi.object({
      id: Joi.number().required(),
      isPembahasan: Joi.boolean(),
    });

    const validate = await schema.validateAsync({
      ...req.params,
      ...req.query,
    });

    const where = {
      id: validate.id,
      userId: req.user?.id,
    };

    if (validate.isPembahasan)
      where.finishAt = { [validate.isPembahasan ? 'lte' : 'gt']: new Date() };

    const result = await database.Tryout.findFirst({
      where,
      include: {
        paketLatihan: true,
      },
    });

    if (!result?.paketLatihan?.isShareAnswer && validate.isPembahasan)
      throw new BadRequestError('Tidak Tersedia Pembahasan');

    if (!result) throw new BadRequestError('Data tidak ditemukan');

    const getAllSoalId = await database.tryoutSoal.findMany({
      where: {
        tryoutId: validate.id,
      },
      select: {
        id: true,
        jawabanSelect: true,
        jawaban: validate.isPembahasan,
        isRaguRagu: true,
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
    return res.status(200).json({
      data: {
        ...result,

        waktuTersisa:
          result.waktuPengerjaan -
          moment().diff(moment(result.createdAt), 'seconds'),

        soalId: getAllSoalId.map((e) => {
          return {
            id: e.id,
            isRaguRagu: e.isRaguRagu,
            isAnswer: e.jawabanSelect,
            status: validate.isPembahasan
              ? JSON.parse(e.jawaban).find(
                  (el) => el.isCorrect == true && e.jawabanSelect == el.id
                )
                ? 'BENAR'
                : 'SALAH'
              : null,
          };
        }),
      },
      msg: 'Get data success',
    });
  } catch (error) {
    next(error);
  }
};

const findSoalTryout = async (req, res, next) => {
  try {
    const schema = Joi.object({
      id: Joi.number().required(),
      isPembahasan: Joi.boolean(),
    });

    const validate = await schema.validateAsync({
      ...req.params,
      ...req.query,
    });

    const result = await database.tryoutSoal.findUnique({
      where: {
        id: validate.id,
      },
      select: {
        id: true,
        soal: true,
        jawabanShow: true,
        pembahasan: validate.isPembahasan,
        sortCategory: true,
        sortSoal: true,
        subCategory: true,
        category: true,
        categoryKet: true,
        jawabanSelect: true,
        jawaban: validate.isPembahasan,
        tipePenilaian: true,
      },
    });

    if (!result) throw new BadRequestError('Data tidak ditemukan');

    result.jawabanShow = JSON.parse(
      validate.isPembahasan ? result.jawaban : result.jawabanShow
    );
    return res.status(200).json({
      data: result,
      msg: 'Get data success',
    });
  } catch (error) {
    next(error);
  }
};

const getAllCategory = async (req, res, next) => {
  try {
    const result = await database.paketPembelianCategory.groupBy({
      by: ['nama'],

      where: {
        paketPembelian: {
          isActive: true,
        },
      },
    });

    return res.status(200).json({
      data: result,
      msg: 'Get data success',
    });
  } catch (error) {
    next(error);
  }
};
const changePassword = async (req, res, next) => {
  try {
    const schema = Joi.object({
      password: Joi.string().min(8).required(),
      oldPassword: Joi.string().min(8).required(),
    });

    const validate = await schema.validateAsync(req.body);

    const user = await database.user.findUnique({
      where: {
        id: req?.user?.id,
      },
    });

    if (!user) throw new BadRequestError('User tidak ditemukan');

    const checkPassword = bcrypt.compareSync(
      validate.oldPassword,
      user.password
    );

    if (!checkPassword) throw new BadRequestError('Password lama salah');

    const hashPassword = bcrypt.hashSync(validate.password, 10);

    const result = await database.user.update({
      where: {
        id: req?.user?.id,
      },
      data: {
        password: hashPassword,
      },
    });

    res.status(200).json({
      data: result,
      msg: 'Berhasil mengubah password',
    });
  } catch (error) {
    next(error);
  }
};
module.exports = {
  getMyClass,
  findMyClass,
  checkVoucher,
  getVoucherAlumni,
  findLatihan,
  findTryout,
  findSoalTryout,
  changeProfile,
  getAllCategory,
  changePassword,
};
