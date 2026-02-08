const Joi = require("joi");

const database = require("#database");
const { returnPagination, filterToJson, deleteFile } = require("#utils");
const { BadRequestError } = require("#errors");

const get = async (req, res, next) => {
  try {
    const schema = Joi.object({
      skip: Joi.number(),
      take: Joi.number(),
      sortBy: Joi.string(),
      descending: Joi.boolean(),
      filters: Joi.object(),
    });

    const validate = await schema.validateAsync(req.query);

    const result = await database.$transaction([
      database.paketLatihan.findMany({
        skip: validate.skip,
        ...(validate.take === 0 ? {} : { take: validate.take }),
        // take: validate.take === 0 ? 10 : validate.take,
        orderBy: {
          [validate.sortBy]: validate.descending ? "desc" : "asc",
        },
        where: filterToJson(validate),
        include: {
          _count: {
            select: {
              PaketLatihanSoal: true,
            },
          },
        },
      }),
      database.paketLatihan.count({
        where: filterToJson(validate),
      }),
    ]);

    return returnPagination(req, res, result);
  } catch (error) {
    next(error);
  }
};
const getPenjualan = async (req, res, next) => {
  try {
    const schema = Joi.object({
      skip: Joi.number(),
      take: Joi.number(),
      sortBy: Joi.string(),
      descending: Joi.boolean(),
      filters: Joi.object(),
    });

    const validate = await schema.validateAsync(req.query);

    const userName = validate?.filters?.userName || "";
    delete validate?.filters?.userName;

    let filterStatus = validate?.filters?.status || undefined;
    delete validate?.filters?.status;

    const namaPaket = validate?.filters?.namaPaket || "";
    delete validate?.filters?.namaPaket;

    let filterExpired = {};

    if (filterStatus === "PAID") {
      filterExpired = {
        OR: [
          {
            expiredAt: {
              gte: new Date(),
            },
          },
          {
            expiredAt: null,
          },
        ],
      };
    }

    if (filterStatus === "OVERDUE") {
      filterExpired = {
        expiredAt: {
          lt: new Date(),
        },
      };

      filterStatus = "PAID";
    }

    const result = await database.$transaction([
      database.pembelian.findMany({
        skip: validate.skip,
        take: validate.take,
        include: {
          user: true,
        },
        orderBy: {
          [validate.sortBy]: validate.descending ? "desc" : "asc",
        },
        where: {
          ...validate.filters,
          ...filterExpired,
          status: filterStatus,
          paketPembelian: {
            nama: {
              contains: namaPaket,
            },
          },
          user: {
            name: {
              contains: userName,
            },
          },
        },
      }),
      database.pembelian.count({
        where: {
          ...validate.filters,
          ...filterExpired,
          status: filterStatus,
          paketPembelian: {
            nama: {
              contains: namaPaket,
            },
          },
          user: {
            name: {
              contains: userName,
            },
          },
        },
      }),
    ]);

    return returnPagination(req, res, result);
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
    const result = await database.paketLatihan.findUnique({
      where: {
        id: validate.id,
      },
    });
    if (!result) throw new BadRequestError("Paket Latihan tidak ditemukan");
    res.status(200).json({
      data: result,
      msg: "Get data by id",
    });
  } catch (error) {
    next(error);
  }
};

const insert = async (req, res, next) => {
  try {
    const schema = Joi.object({
      nama: Joi.string().required(),
      type: Joi.string().valid("BIASA", "TRYOUT").required(),
      startAt:
        req.body.type === "TRYOUT"
          ? Joi.date().required()
          : Joi.date().allow(null),
      endAt:
        req.body.type === "TRYOUT"
          ? Joi.date().required()
          : Joi.date().allow(null),
      waktu:
        req.body.type === "BIASA"
          ? Joi.number().required()
          : Joi.number().allow(null),
      kkm: Joi.number().allow(null).default(0),
      banner: Joi.string().required(),
      pdf: Joi.string().allow(null), // tambah validasi pdf
      isShareAnswer: Joi.boolean().required(),
      keterangan: Joi.allow(null, ""),
    });

    const validate = await schema.validateAsync(
      {
        ...req.body,
        banner: req.files?.banner?.[0]?.path,
        pdf: req.files?.pdf?.[0]?.path || null,
      },
      {
        stripUnknown: true,
      }
    );

    const result = await database.paketLatihan.create({
      data: validate,
    });

    res.status(200).json({
      data: result,
      msg: "Berhasil menambahkan paket latihan",
    });
  } catch (error) {
    next(error);
  }
};

const update = async (req, res, next) => {
  try {
    const schema = Joi.object({
      id: Joi.number().required(),
      nama: Joi.string().required(),
      type: Joi.string().valid("BIASA", "TRYOUT").required(),
      startAt:
        req.body.type === "TRYOUT"
          ? Joi.date().required()
          : Joi.date().allow(null),
      endAt:
        req.body.type === "TRYOUT"
          ? Joi.date().required()
          : Joi.date().allow(null),
      waktu:
        req.body.type === "BIASA"
          ? Joi.number().required()
          : Joi.number().allow(null),
      kkm: Joi.number().allow(null).default(0),
      banner: Joi.string(),
      pdf: Joi.string().allow(null),
      isShareAnswer: Joi.boolean().required(),
      keterangan: Joi.allow(null, ""),
    });

    const validate = await schema.validateAsync(
      {
        ...req.body,
        id: req.params.id,
        banner: req.files?.banner?.[0]?.path,
        pdf: req.files?.pdf?.[0]?.path || null,
      },
      { stripUnknown: true }
    );

    const isExist = await database.paketLatihan.findUnique({
      where: { id: validate.id },
    });

    if (!isExist) throw new BadRequestError("Paket latihan tidak ditemukan");

    if (req.files?.banner?.[0]?.path) deleteFile(isExist.banner);
    if (req.files?.pdf?.[0]?.path && isExist.pdf) deleteFile(isExist.pdf);

    // Remove id from data
    const { id, ...dataWithoutId } = validate;

    const result = await database.paketLatihan.update({
      where: { id },
      data: dataWithoutId,
    });

    res.status(200).json({
      data: result,
      msg: "Berhasil mengubah paket latihan",
    });
  } catch (error) {
    next(error);
  }
};

const remove = async (req, res, next) => {
  try {
    const schema = Joi.object({
      id: Joi.number().required(),
    });

    const validate = await schema.validateAsync(req.params);

    const isExist = await database.paketLatihan.findUnique({
      where: {
        id: validate.id,
      },
    });

    if (!isExist) throw new BadRequestError("Kategori tidak ditemukan");

    const result = await database.paketLatihan.delete({
      where: {
        id: validate.id,
      },
    });

    res.status(200).json({
      data: result,
      msg: "Berhasil menghapus kategori paket latihan",
    });
  } catch (error) {
    next(error);
  }
};

const finishPayment = async (req, res, next) => {
  try {
    const schema = Joi.object({
      id: Joi.number().required(),
    });

    const validate = await schema.validateAsync(req.body);

    const checkPembelian = await database.pembelian.findUnique({
      where: {
        id: validate.id,
      },
    });

    if (!checkPembelian) throw new BadRequestError("Pembelian tidak ditemukan");

    if (checkPembelian.status === "PAID")
      throw new BadRequestError("Pembelian sudah selesai");

    await database.pembelian.update({
      where: {
        id: validate.id,
      },
      data: {
        status: "PAID",
        paidAt: new Date(),
      },
    });
    await database.notificationUser.create({
      data: {
        user: { connect: { id: checkPembelian.userId } },
        title: "Pembelian Berhasil",
        keterangan: `Anda telah membeli paket ${checkPembelian.namaPaket}, silahkan cek paket anda di halaman riwayat pembelian`,
        url: "/paket-pembelian/riwayat",
        type: "SYSTEM",
        status: "PAYMENT_SUCCESS",
      },
    });

    return res.status(200).json({
      msg: "Pembayaran berhasil",
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
  getPenjualan,
  finishPayment,
};
