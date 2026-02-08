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
      database.paketPembelianMateri.findMany({
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
      database.paketPembelianMateri.count({
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

const getCategory = async (req, res, next) => {
  try {
    const result = await database.paketPembelianMateri.groupBy({
      by: ['category'],
      _count: {
        category: true,
      },
    });
    res.status(200).json({
      data: result,
      msg: 'Get all data',
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

    const result = await database.paketPembelianMateri.findUnique({
      where: {
        id: validate.id,
      },
      select: {
        id: true, // Include other scalar fields you need
        nama: true,
        keterangan: true,
        createdAt: true,
        updatedAt: true,
        category: true,
        BankSoal: {
          select: {
            id: true,
            soal: true,
            pembahasan: true,
            BankSoalJawaban: {
              select: {
                id: true,
                jawaban: true,
                isCorrect: true,
                point: true,
              },
            },
          },
        },
      },
    });

    if (!result) throw new BadRequestError('Kategori tidak ditemukan');

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
      materi: Joi.string(),
      link: Joi.string().allow(null, ''),
      nama: Joi.string().required(),
      category: Joi.string().allow(null, ''),
    });

    const validate = await schema.validateAsync(req.body);

    const result = await database.paketPembelianMateri.create({
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
      materi: Joi.string(),
      link: Joi.string(),
      nama: Joi.string().required(),
      category: Joi.string().allow(null, ''),
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

    const isExist = await database.paketPembelianMateri.findUnique({
      where: {
        id: validate.id,
      },
    });

    if (!isExist) throw new BadRequestError('Materi tidak ditemukan');

    const result = await database.paketPembelianMateri.update({
      where: {
        id: validate.id,
      },
      data: validate,
    });

    res.status(200).json({
      data: result,
      msg: 'Berhasil mengubah data Materi',
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

    const isExist = await database.paketPembelianMateri.findUnique({
      where: {
        id: validate.id,
      },
    });

    if (!isExist) throw new BadRequestError('Materi tidak ditemukan');

    const result = await database.paketPembelianMateri.delete({
      where: {
        id: validate.id,
      },
    });

    res.status(200).json({
      data: result,
      msg: 'Berhasil menghapus Materi',
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
  getCategory,
};
