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
      database.paketPembelianBimbel.findMany({
        ...take,
        skip: validate.skip,
        orderBy: {
          [validate.sortBy]: validate.descending ? 'desc' : 'asc',
        },
        select: {
          id: true, // Include other scalar fields you need
          nama: true,
          createdAt: true,
          updatedAt: true,
          status: true,
          date: true,
          materiLink: true,
          videoLink: true,
          rekamanLink: true,
          mentor: true,
          paketLatihan: {
            select: {
              id: true,
              nama: true,
            },
          },
        },
        where: {
          paketPembelianId: validate.paketPembelianId,
          ...filterToJson(validate),
        },
      }),
      database.paketPembelianBimbel.count({
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

const find = async (req, res, next) => {
  try {
    const schema = Joi.object({
      id: Joi.number().required(),
    });

    const validate = await schema.validateAsync(req.params);

    const result = await database.paketPembelianBimbel.findUnique({
      where: {
        id: validate.id,
      },
      select: {
        id: true, // Include other scalar fields you need
        nama: true,
        keterangan: true,
        createdAt: true,
        updatedAt: true,
        date: true,
        mentor: true,
        paketLatihan: {
          select: {
            id: true,
            nama: true,
          },
        },
      },
    });

    if (!result) throw new BadRequestError('Bimbel tidak ditemukan');

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
      paketPembelianId: Joi.number().required(),
      nama: Joi.string().required(),
      date: Joi.date(),
      mentor: Joi.string().empty(''),
      materiLink: Joi.string().empty(''),
      videoLink: Joi.string().empty(''),
      rekamanLink: Joi.string().empty(''),
      paketLatihanId: Joi.number(),
      status: Joi.string(),
    });

    const validate = await schema.validateAsync(req.body);

    const result = await database.paketPembelianBimbel.create({
      data: validate,
    });

    res.status(200).json({
      data: result,
      msg: 'Berhasil menambahkan Bimbel',
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
      date: Joi.date(),
      mentor: Joi.string().empty(''),
      materiLink: Joi.string().allow(null, ''),
      videoLink: Joi.string().allow(null, ''),
      rekamanLink: Joi.string().allow(null, ''),
      paketLatihanId: Joi.number(),
      status: Joi.string(),
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

    const isExist = await database.paketPembelianBimbel.findUnique({
      where: {
        id: validate.id,
      },
    });

    if (!isExist) throw new BadRequestError('Bimbel tidak ditemukan');

    const result = await database.paketPembelianBimbel.update({
      where: {
        id: validate.id,
      },
      data: validate,
    });

    res.status(200).json({
      data: result,
      msg: 'Berhasil mengubah data Bimbel',
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

    const isExist = await database.paketPembelianBimbel.findUnique({
      where: {
        id: validate.id,
      },
    });

    if (!isExist) throw new BadRequestError('Materi tidak ditemukan');

    const result = await database.paketPembelianBimbel.delete({
      where: {
        id: validate.id,
      },
    });

    res.status(200).json({
      data: result,
      msg: 'Berhasil menghapus Bimbel',
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
