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
      parentCategoryId: Joi.number().allow(null),
    }).unknown(true);

    const validate = await schema.validateAsync(req.query);

    const take = validate.take ? { take: validate.take } : {};

    const result = await database.$transaction([
      database.bankSoalCategory.findMany({
        ...take,
        skip: validate.skip,
        orderBy: {
          [validate.sortBy]: validate.descending ? 'desc' : 'asc',
        },
        where: {
          ...filterToJson(validate),
          parentCategoryId: validate.parentCategoryId,
        },
        include: {
          // BankSoal: {
          //   select: {
          //     subCategory: true,
          //   },
          // },
          _count: {
            select: {
              BankSoal: true,
            },
          },
        },
      }),
      database.bankSoalCategory.count({
        where: {
          ...filterToJson(validate),
          parentCategoryId: validate.parentCategoryId,
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

    const result = await database.bankSoalCategory.findUnique({
      where: {
        id: validate.id,
      },
      select: {
        id: true, // Include other scalar fields you need
        nama: true,
        // keterangan: true,
        parentCategoryId: true,
        createdAt: true,
        updatedAt: true,
        BankSoal: {
          select: {
            id: true,
            soal: true,
            pembahasan: true,
            subCategory: true,
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
      nama: Joi.string().required(),
      keterangan: Joi.allow(null, ''),
      kkm: Joi.number().allow(null, '', 0),
      parentCategoryId: Joi.number().allow(null, ''),
      tipePenilaian: Joi.string().required(),
    });

    const validate = await schema.validateAsync(
      { ...req.body },
      {
        stripUnknown: true,
      }
    );
    const data = {
      data: {
        ...validate,
        parentCategory: {
          connect: {
            id: validate.parentCategoryId,
          },
        },
      },
    };

    delete data.data.parentCategoryId;

    const result = await database.bankSoalCategory.create(data);

    res.status(200).json({
      data: result,
      msg: 'Berhasil menambahkan Kategori Bank Soal',
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
      kkm: Joi.number().allow(null, '', 0),
      parentCategoryId: Joi.number().allow(null, ''),
      tipePenilaian: Joi.string().required(),
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

    const isExist = await database.bankSoalCategory.findUnique({
      where: {
        id: validate.id,
      },
    });

    if (!isExist) throw new BadRequestError('Kategori tidak ditemukan');

    const data = {
      data: {
        ...validate,
        parentCategory: {
          connect: {
            id: validate.parentCategoryId,
          },
        },
      },
    };

    delete data.data.parentCategoryId;
    delete data.data.id;

    const result = await database.bankSoalCategory.update({
      where: {
        id: validate.id,
      },
      data: data.data,
    });

    res.status(200).json({
      data: result,
      msg: 'Berhasil mengubah data kategori bank soal',
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

    const isExist = await database.bankSoalCategory.findUnique({
      where: {
        id: validate.id,
      },
    });

    if (!isExist) throw new BadRequestError('Kategori tidak ditemukan');

    const result = await database.bankSoalCategory.delete({
      where: {
        id: validate.id,
      },
    });

    res.status(200).json({
      data: result,
      msg: 'Berhasil menghapus kategori bank soal',
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
