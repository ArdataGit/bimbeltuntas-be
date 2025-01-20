const Joi = require('joi');

const database = require('#database');
const { BadRequestError } = require('#errors');
const { filterToJson, returnPagination } = require('#utils');

const get = async (req, res, next) => {
  try {
    const schema = Joi.object({
      skip: Joi.number(),
      take: Joi.number(),
      sortBy: Joi.string(),
      descending: Joi.boolean(),
      filters: Joi.object(),
      paketCategoryId: Joi.number().required(),
    });

    const validate = await schema.validateAsync(req.query, {
      stripUnknown: true,
    });

    const result = await database.$transaction([
      database.paketSubCategory.findMany({
        skip: validate.skip,
        take: validate.take,
        orderBy: {
          [validate.sortBy]: validate.descending ? 'desc' : 'asc',
        },
        where: {
          ...filterToJson(validate),
          paketCategoryId: validate.paketCategoryId,
        },
      }),
      database.paketSubCategory.count({
        where: {
          ...filterToJson(validate),
          paketCategoryId: validate.paketCategoryId,
        },
      }),
    ]);

    return returnPagination(req, res, result);
  } catch (error) {
    next(error);
  }
};

const insert = async (req, res, next) => {
  try {
    const schema = Joi.object({
      nama: Joi.string().required(),
      keterangan: Joi.allow(null, ''),
      paketCategory: Joi.number().required(),
    });

    const validate = await schema.validateAsync(req.body);

    const checkCategory = await database.paketCategory.findUnique({
      where: {
        id: validate.paketCategory,
      },
    });

    if (!checkCategory) throw new BadRequestError('Kategori tidak ditemukan');

    const result = await database.paketSubCategory.create({
      data: {
        ...validate,
        paketCategory: {
          connect: {
            id: validate.paketCategory,
          },
        },
      },
    });

    res.status(200).json({
      data: result,
      msg: 'Berhasil menambahkan kategori paket',
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
      keterangan: Joi.allow(null, ''),
    });

    const validate = await schema.validateAsync(
      {
        ...req.body,
        ...req.params,
      },
      {
        stripUnknown: true,
      }
    );

    const isExist = await database.paketSubCategory.findUnique({
      where: {
        id: validate.id,
      },
    });

    if (!isExist) throw new BadRequestError('Sub Kategori tidak ditemukan');

    const result = await database.paketSubCategory.update({
      where: {
        id: validate.id,
      },
      data: {
        nama: validate.nama,
        keterangan: validate.keterangan,
      },
    });

    res.status(200).json({
      data: result,
      msg: 'Berhasil mengubah data sub kategori paket',
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

    const isExist = await database.paketSubCategory.findUnique({
      where: {
        id: validate.id,
      },
    });

    if (!isExist) throw new BadRequestError('Kategori tidak ditemukan');

    const result = await database.paketSubCategory.delete({
      where: {
        id: validate.id,
      },
    });

    res.status(200).json({
      data: result,
      msg: 'Berhasil menghapus sub kategori paket',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { get, insert, update, remove };
