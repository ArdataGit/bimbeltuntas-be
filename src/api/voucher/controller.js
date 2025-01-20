const Joi = require('joi');

const database = require('#database');
const { returnPagination, deleteFile, filterToJson } = require('#utils');
const { BadRequestError } = require('#errors');

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
      database.voucher.findMany({
        skip: validate.skip,
        take: validate.take,
        orderBy: {
          [validate.sortBy]: validate.descending ? 'desc' : 'asc',
        },
        include: {
          VoucherProduct: {
            include: {
              paketPembelian: true,
            },
          },
        },
        where: {
          ...filterToJson(validate),
          deletedAt: null,
        },
      }),
      database.voucher.count({
        where: {
          deletedAt: null,
          ...filterToJson(validate),
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

    const result = await database.voucher.findFirst({
      where: {
        id: validate.id,
        deletedAt: null,
      },
    });

    if (!result) throw new BadRequestError('Voucher tidak ditemukan');

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
      kode: Joi.string(),
      gambar: Joi.string().required(),
      keterangan: Joi.allow(null, ''),
      value: Joi.number().required(),
      status: Joi.string().valid('AKTIF', 'NONAKTIF').required(),
      tipe: Joi.string().valid('NORMAL', 'ALUMNI').required().required(),
      tipePotongan: Joi.string().valid('PERSEN', 'HARGA').required(),
      voucherProduct: Joi.alternatives().try(
        Joi.string(),
        Joi.array().items(Joi.string()) // Ini memungkinkan array dari string
      ),
    });

    const validate = await schema.validateAsync({
      ...req.body,
      gambar: req?.file?.path,
    });

    const checkExist = await database.voucher.findUnique({
      where: {
        kode: validate.kode || '',
      },
    });

    if (checkExist) throw new BadRequestError('Kode voucher sudah ada');

    if (validate.tipe === 'ALUMNI') {
      await database.voucher.updateMany({
        where: {
          deletedAt: null,
          tipe: 'ALUMNI',
        },
        data: {
          status: 'NONAKTIF',
        },
      });
    }

    const result = await database.voucher.create({
      data: { ...validate, voucherProduct: undefined },
    });

    validate.voucherProduct =
      typeof validate.voucherProduct == 'string'
        ? [validate.voucherProduct]
        : validate.voucherProduct;

    if (validate?.voucherProduct?.length) {
      await database.voucherProduct.createMany({
        data: validate.voucherProduct.map((item) => ({
          voucherId: result.id,
          paketId: Number(item),
        })),
      });
    }
    delete validate.voucherProduct;

    res.status(200).json({
      data: result,
      msg: 'Berhasil menambahkan voucher',
    });
  } catch (error) {
    next(error);
  }
};

const update = async (req, res, next) => {
  try {
    const schema = Joi.object({
      id: Joi.number().required(),
      kode: Joi.string(),
      tipe: Joi.string().required(),
      keterangan: Joi.allow(null, ''),
      value: Joi.number().required(),
      status: Joi.string().valid('AKTIF', 'NONAKTIF').required(),
      gambar: Joi.string(),
      tipePotongan: Joi.string().valid('PERSEN', 'HARGA').required(),
      voucherProduct: Joi.alternatives().try(
        Joi.string(),
        Joi.array().items(Joi.string()) // Ini memungkinkan array dari string
      ),
    });

    const validate = await schema.validateAsync(
      {
        ...req.params,
        ...req.body,
        gambar: req?.file?.path,
      },
      {
        stripUnknown: true,
      }
    );

    const isExist = await database.voucher.findUnique({
      where: {
        id: validate.id,
        deletedAt: null,
      },
    });

    if (!isExist) throw new BadRequestError('Voucher tidak ditemukan');

    await database.voucherProduct.deleteMany({
      where: {
        voucherId: validate.id,
      },
    });
    validate.voucherProduct =
      typeof validate.voucherProduct == 'string'
        ? [validate.voucherProduct]
        : validate.voucherProduct;

    if (validate?.voucherProduct?.length) {
      await database.voucherProduct.createMany({
        data: validate.voucherProduct.map((item) => ({
          voucherId: validate.id,
          paketId: Number(item),
        })),
      });
    }

    delete validate.voucherProduct;
    const result = await database.voucher.update({
      where: {
        id: validate.id,
      },
      data: {
        ...validate,
        id: undefined,
      },
    });

    if (validate.gambar) deleteFile(isExist.gambar);

    res.status(200).json({
      data: result,
      msg: 'Berhasil mengubah data voucher',
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

    const isExist = await database.voucher.findUnique({
      where: {
        id: validate.id,
        deletedAt: null,
      },
    });

    if (!isExist) throw new BadRequestError('Voucher tidak ditemukan');

    const result = await database.voucher.update({
      where: {
        id: validate.id,
      },
      data: {
        deletedAt: new Date(),
      },
    });

    res.status(200).json({
      data: result,
      msg: 'Berhasil menghapus data voucher',
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
};
