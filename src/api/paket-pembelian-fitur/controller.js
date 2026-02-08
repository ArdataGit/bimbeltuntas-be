const Joi = require('joi');

const database = require('#database');
const { returnPagination, filterToJson } = require('#utils');
const { BadRequestError } = require('#errors');

const get = async (req, res, next) => {
  try {
    const schema = Joi.object({
      skip: Joi.number(),
      take: Joi.number(),
      sortBy: Joi.string(),
      descending: Joi.boolean(),
      filters: Joi.object(),
      paketPembelianId: Joi.number(),
    });

    const validate = await schema.validateAsync(req.query);

    const take = validate.take ? { take: validate.take } : {};

    const result = await database.$transaction([
      database.paketPembelianFitur.findMany({
        ...take,
        skip: validate.skip,
        orderBy: {
          [validate.sortBy]: validate.descending ? 'desc' : 'asc',
        },
        where: {
          paketPembelianId: validate.paketPembelianId,
          ...filterToJson(validate),
        },
      }),
      database.paketPembelianFitur.count({
        where: {
          paketPembelianId: validate.paketPembelianId,
          ...filterToJson(validate),
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
      paketPembelianId: Joi.number().required(),
      nama: Joi.string().required(),
    });

    const validate = await schema.validateAsync(req.body);

    const result = await database.paketPembelianFitur.create({
      data: validate,
    });

    res.status(200).json({
      data: result,
      msg: 'Berhasil menambahkan Materi',
    });
  } catch (error) {
    next(error);
  }
};

const update = async (req, res, next) => {
  try {
    const schema = Joi.object({
      id: Joi.number().required(),
      paketPembelianId: Joi.number().required(),
      nama: Joi.string().required(),
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

    const isExist = await database.paketPembelianFitur.findUnique({
      where: {
        id: validate.id,
      },
    });

    if (!isExist) throw new BadRequestError('Fitur tidak ditemukan');

    const result = await database.paketPembelianFitur.update({
      where: {
        id: validate.id,
      },
      data: validate,
    });

    res.status(200).json({
      data: result,
      msg: 'Berhasil mengubah fitur',
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

    const isExist = await database.paketPembelianFitur.findUnique({
      where: {
        id: validate.id,
      },
    });

    if (!isExist) throw new BadRequestError('Fitur tidak ditemukan');

    const result = await database.paketPembelianFitur.delete({
      where: {
        id: validate.id,
      },
    });

    res.status(200).json({
      data: result,
      msg: 'Berhasil menghapus fitur',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  get,
  insert,
  update,
  remove,
};
