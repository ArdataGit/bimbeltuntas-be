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
      database.homeSection.findMany({
        skip: validate.skip,
        take: validate.take,
        orderBy: {
          [validate.sortBy]: validate.descending ? 'desc' : 'asc',
        },
        where: {
          ...filterToJson(validate),
        },
      }),
      database.homeSection.count({
        where: {
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
      title: Joi.string(),
      bintang: Joi.number(),
      pekerjaan: Joi.string(),
      keterangan: Joi.string(),
      url: Joi.string(),
      gambar: Joi.string(),
      tipe: Joi.string(),
    });

    const validate = await schema.validateAsync({
      ...req.body,
      gambar: req?.file?.path,
    });

    const result = await database.homeSection.create({
      data: validate,
    });

    res.status(200).json({
      data: result,
      msg: 'Berhasil menambahkan section',
    });
  } catch (error) {
    next(error);
  }
};

const update = async (req, res, next) => {
  try {
    const schema = Joi.object({
      title: Joi.string(),
      bintang: Joi.number(),
      pekerjaan: Joi.string(),
      keterangan: Joi.string(),
      url: Joi.string(),
      gambar: Joi.string(),
      tipe: Joi.string(),
      id: Joi.number().required(),
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

    const isExist = await database.homeSection.findUnique({
      where: {
        id: validate.id,
      },
    });

    if (!isExist) throw new BadRequestError('Section tidak ditemukan');

    const result = await database.homeSection.update({
      where: {
        id: validate.id,
      },
      data: validate,
    });

    if (validate.gambar) deleteFile(isExist.gambar);

    res.status(200).json({
      data: result,
      msg: 'Berhasil mengubah data Section',
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

    const isExist = await database.homeSection.findUnique({
      where: {
        id: validate.id,
      },
    });

    if (!isExist) throw new BadRequestError('Section tidak ditemukan');

    const result = await database.homeSection.delete({
      where: {
        id: validate.id,
      },
    });

    res.status(200).json({
      data: result,
      msg: 'Berhasil menghapus data Section',
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
