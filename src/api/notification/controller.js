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
      database.notification.findMany({
        skip: validate.skip,
        take: validate.take,
        orderBy: {
          [validate.sortBy]: validate.descending ? 'desc' : 'asc',
        },
        where: {
          ...filterToJson(validate),
        },
        select: {
          id: true,
          keterangan: true,
          title: true,
          url: true,
          icon: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              NotificationUser: {
                where: {
                  isRead: true,
                },
              },
            },
          },
        },
      }),
      database.notification.count({
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

const find = async (req, res, next) => {
  try {
    const schema = Joi.object({
      id: Joi.number().required(),
    });

    const validate = await schema.validateAsync(req.params);

    const result = await database.notification.findUnique({
      where: {
        id: validate.id,
      },
    });

    if (!result) throw new BadRequestError('Notifikasi tidak ditemukan');

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
      keterangan: Joi.allow(null, ''),
      title: Joi.string().required(),
      url: Joi.string(),
      icon: Joi.string(),
    });

    const validate = await schema.validateAsync({
      ...req.body,
    });

    const result = await database.notification.create({
      data: { ...validate },
    });

    const getAllUser = await database.user.findMany({
      select: {
        id: true,
      },
    });

    await database.notificationUser.createMany({
      data: getAllUser.map((item) => ({
        userId: item.id,
        notificationId: result.id,
        type: 'USER',
      })),
    });

    res.status(200).json({
      data: result,
      msg: 'Berhasil menambahkan notifikasi',
    });
  } catch (error) {
    next(error);
  }
};

const update = async (req, res, next) => {
  try {
    const schema = Joi.object({
      id: Joi.number().required(),
      keterangan: Joi.allow(null, ''),
      title: Joi.string().required(),
      url: Joi.string(),
      icon: Joi.string(),
    });

    const validate = await schema.validateAsync(
      {
        ...req.params,
        ...req.body,
      },
      {
        stripUnknown: true,
      }
    );

    const isExist = await database.notification.findUnique({
      where: {
        id: validate.id,
      },
    });

    if (!isExist) throw new BadRequestError('Notifikasi tidak ditemukan');

    const result = await database.notification.update({
      where: {
        id: validate.id,
      },
      data: validate,
    });

    if (validate.gambar) deleteFile(isExist.gambar);

    res.status(200).json({
      data: result,
      msg: 'Berhasil mengubah notifikasi',
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

    const isExist = await database.notification.findUnique({
      where: {
        id: validate.id,
      },
    });

    if (!isExist) throw new BadRequestError('Notifikasi tidak ditemukan');

    const result = await database.notification.delete({
      where: {
        id: validate.id,
      },
    });

    res.status(200).json({
      data: result,
      msg: 'Berhasil menghapus Notifikasi',
    });
  } catch (error) {
    next(error);
  }
};

const read = async (req, res, next) => {
  try {
    const schema = Joi.object({
      id: Joi.number().required(),
    });

    const validate = await schema.validateAsync(req.body);

    const isExist = await database.notificationUser.findUnique({
      where: {
        id: validate.id,
      },
    });

    if (!isExist) throw new BadRequestError('Notifikasi tidak ditemukan');

    const result = await database.notificationUser.update({
      where: {
        id: validate.id,
      },
      data: {
        isRead: true,
      },
    });

    res.status(200).json({
      data: result,
      msg: 'Berhasil menghapus Notifikasi',
    });
  } catch (error) {
    next(error);
  }
};

const readAll = async (req, res, next) => {
  try {
    const isExist = await database.user.findUnique({
      where: {
        id: req?.user?.id,
      },
    });

    if (!isExist) throw new BadRequestError('User tidak ditemukan');

    const result = await database.notificationUser.updateMany({
      where: {
        userId: req?.user?.id,
      },
      data: {
        isRead: true,
      },
    });

    res.status(200).json({
      data: result,
      msg: 'Berhasil menghapus Notifikasi',
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
  read,
  readAll,
};
