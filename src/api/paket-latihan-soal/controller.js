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
      paketLatihanId: Joi.number().required(),
    });

    const validate = await schema.validateAsync(req.query);

    const result = await database.$transaction([
      database.paketLatihanSoal.findMany({
        skip: validate.skip,
        take: validate.take,
        orderBy: {
          [validate.sortBy]: validate.descending ? 'desc' : 'asc',
        },
        where: {
          ...filterToJson(validate),
          paketLatihanId: validate.paketLatihanId,
        },
        select: {
          id: true,
          isRandomQuestion: true,
          bankSoalCategory: {
            select: {
              id: true,
              nama: true,
              _count: {
                select: {
                  BankSoal: true,
                },
              },
            },
          },
        },
      }),
      database.paketLatihanSoal.count({
        where: {
          ...filterToJson(validate),
          paketLatihanId: validate.paketLatihanId,
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
      paketLatihanId: Joi.number().required(),
      bankSoalCategoryId: Joi.number().required(),
      isRandomQuestion: Joi.boolean().allow(null, ''),
    });

    const validate = await schema.validateAsync(req.body, {
      stripUnknown: true,
    });

    const isPaketLatihanExist = await database.paketLatihan.findUnique({
      where: {
        id: validate.paketLatihanId,
      },
    });

    if (!isPaketLatihanExist)
      throw new BadRequestError('Paket latihan tidak ditemukan');

    const isBankSoalCategoryExist = await database.bankSoalCategory.findUnique({
      where: {
        id: validate.bankSoalCategoryId,
      },
    });
    if (!isBankSoalCategoryExist)
      throw new BadRequestError('Kategori bank soal tidak ditemukan');

    const isPaketLatihanSoalExist = await database.paketLatihanSoal.findFirst({
      where: {
        paketLatihanId: validate.paketLatihanId,
        bankSoalCategoryId: validate.bankSoalCategoryId,
      },
    });

    if (isPaketLatihanSoalExist)
      throw new BadRequestError('Paket latihan soal sudah ada');

    const result = await database.paketLatihanSoal.create({
      data: {
        paketLatihanId: validate.paketLatihanId,
        bankSoalCategoryId: validate.bankSoalCategoryId,
        isRandomQuestion: validate.isRandomQuestion,
      },
    });

    res.status(200).json({
      data: result,
      msg: 'Berhasil Paket Latihan Soal',
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
    const isExist = await database.paketLatihanSoal.findUnique({
      where: {
        id: validate.id,
      },
    });
    if (!isExist)
      throw new BadRequestError('Paket Latihan Soal tidak ditemukan');
    const result = await database.paketLatihanSoal.delete({
      where: {
        id: validate.id,
      },
    });
    res.status(200).json({
      data: result,
      msg: 'Berhasil menghapus Paket Latihan Soal',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  get,
  insert,
  remove,
};
