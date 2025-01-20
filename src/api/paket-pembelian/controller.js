const Joi = require('joi');

const database = require('#database');
const { returnPagination, filterToJson, deleteFile } = require('#utils');
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

    const take = validate.take ? { take: validate.take } : {};

    const result = await database.$transaction([
      database.paketPembelian.findMany({
        ...take,
        skip: validate.skip,
        orderBy: {
          [validate.sortBy]: validate.descending ? 'desc' : 'asc',
        },
        where: filterToJson(validate),
        select: {
          id: true,
          nama: true,
          harga: true,
          keterangan: true,
          isActive: true,
          durasi: true,
          requirement: true,
          createdAt: true,
          panduan: true,
          gambar: true,
          paketPembelianFitur: {
            select: {
              nama: true,
            },
          },
          paketPembelianCategory: {
            select: {
              nama: true,
            },
          },
          _count: {
            select: {
              paketPembelianMateri: true,
              paketPembelianBimbel: true,
              paketPembelianFitur: true,
              paketPembelianTryout: true,
              Pembelian: true,
            },
          },
        },
      }),
      database.paketPembelian.count({
        where: filterToJson(validate),
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

    const result = await database.paketPembelian.findUnique({
      where: {
        id: validate.id,
      },
    });

    if (!result) throw new BadRequestError('Paket tidak ditemukan');

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
      nama: Joi.string().required(),
      harga: Joi.number().required().allow(0),
      keterangan: Joi.allow(null, ''),
      durasi: Joi.number(),
      gambar: Joi.string(),
      category: Joi.string(),
      requirement: Joi.allow(null, ''),
      panduan: Joi.string(),
      isActive: Joi.string(),
    });

    const { category, ...validate } = await schema.validateAsync(
      { ...req.body, gambar: req?.file?.path },
      {
        stripUnknown: true,
      }
    );
    const categoryJSON = JSON.parse(category);

    if (validate.isActive === '1' || validate.isActive === true) {
      validate.isActive = true;
    } else {
      validate.isActive = false;
    }

    const result = await database.paketPembelian.create({
      data: validate,
    });

    await database.paketPembelianCategory.createMany({
      data: categoryJSON.map((item) => ({
        paketPembelianId: result.id,
        nama: item,
      })),
    });

    res.status(200).json({
      data: result,
      msg: 'Berhasil menambahkan paket pembelian',
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
      harga: Joi.number().required().allow(0),
      keterangan: Joi.allow(null, ''),
      requirement: Joi.allow(null, ''),
      durasi: Joi.number(),
      gambar: Joi.string(),
      category: Joi.string(),
      panduan: Joi.string(),
      isActive: Joi.string(),
    });

    const { category, ...validate } = await schema.validateAsync(
      {
        ...req.body,
        ...req.params,
        gambar: req?.file?.path,
      },
      {
        stripUnknown: true,
      }
    );

    const isExist = await database.paketPembelian.findUnique({
      where: {
        id: validate.id,
      },
    });

    if (!isExist) throw new BadRequestError('Paket Pembelian tidak ditemukan');

    if (req?.file?.path) {
      deleteFile(isExist.gambar);
    }

    if (validate.isActive === '1' || validate.isActive === true) {
      validate.isActive = true;
    } else {
      validate.isActive = false;
    }

    const result = await database.paketPembelian.update({
      where: {
        id: validate.id,
      },
      data: validate,
    });

    const categoryJSON = JSON.parse(category);

    await database.paketPembelianCategory.deleteMany({
      where: {
        paketPembelianId: result.id,
      },
    });

    await database.paketPembelianCategory.createMany({
      data: categoryJSON.map((item) => ({
        paketPembelianId: result.id,
        nama: item,
      })),
    });

    res.status(200).json({
      data: result,
      msg: 'Berhasil mengubah data paket pembelian',
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

    const isExist = await database.paketPembelian.findUnique({
      where: {
        id: validate.id,
      },
    });

    if (!isExist) throw new BadRequestError('Paket Pembelian tidak ditemukan');

    const result = await database.paketPembelian.delete({
      where: {
        id: validate.id,
      },
    });

    res.status(200).json({
      data: result,
      msg: 'Berhasil menghapus Paket Pembelian',
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
