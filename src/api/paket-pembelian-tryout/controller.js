const Joi = require('joi');

const excelJS = require('exceljs');
const moment = require('moment');
const { convert } = require('html-to-text');

const database = require('#database');
const {
  returnPagination,
  filterToJson,
  konversiDetikKeWaktu,
} = require('#utils');
const { BadRequestError } = require('#errors');

const getIndexAnswer = (jawabanSelect, jawaban) => {
  const jwb = JSON.parse(jawaban);
  const index = jwb.findIndex((item) => item.id === jawabanSelect);
  return String.fromCharCode(65 + index) || '-';
};

const getIndexSelectedAnswer = (jawaban) => {
  const jwb = JSON.parse(jawaban);
  const index = jwb.findIndex((item) => item.isCorrect);
  return String.fromCharCode(65 + index) || '-';
};

const formatDate = 'DD/MM/YYYY HH:mm';

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
      database.paketPembelianTryout.findMany({
        ...take,
        skip: validate.skip,
        select: {
          id: true,
          paketPembelianId: true,
          isRandomQuestion: true,
          paketLatihanId: true,
          category: true,
          type: true,
          startDate: true,
          endDate: true,
          limit: true,
          PaketLatihan: {
            select: {
              id: true,
              nama: true,
              waktu: true,
              PaketLatihanSoal: {
                select: {
                  bankSoalCategory: {
                    select: {
                      id: true,
                      _count: {
                        select: {
                          BankSoal: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          _count: {
            select: {
              Tryout: {
                where: {
                  paketPembelianTryout: validate.id,
                },
              },
            },
          },
        },
        orderBy: {
          [validate.sortBy]: validate.descending ? 'desc' : 'asc',
        },
        where: {
          paketPembelianId: validate.paketPembelianId,
          ...filterToJson(validate),
        },
      }),
      database.paketPembelianTryout.count({
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

    const result = await database.paketPembelianTryout.findUnique({
      where: {
        id: validate.id,
      },
      include: {
        PaketLatihan: true,
      },
    });

    res.status(200).json({
      data: result,
      msg: 'Berhasil mendapatkan tryout',
    });
  } catch (error) {
    next(error);
  }
};

const processUser = async (users, index, worksheet) => {
  if (index >= users.length) {
    return; // Base case: stop recursion when all users have been processed
  }

  const user = users[index];
  let pointCategory = '';
  const getCat = await database.$queryRaw`
    (
      SELECT
          JSON_ARRAYAGG(
              JSON_OBJECT(
                  'category', subquery.category,
                  'kkm', subquery.kkm,
                  'maxPoint', subquery.maxPoint,
                  'all_point', COALESCE(subquery.all_point, 0)
              )
          ) as val
      FROM (
          SELECT
              ts.category,
              ts.kkm,
              ts.maxPoint,
              COALESCE(SUM(ts.point), 0) AS all_point
          FROM TryoutSoal ts
          WHERE ts.tryoutId = ${user.id}
          GROUP BY ts.category, ts.kkm, ts.maxPoint
      ) subquery
    )`;
  JSON.parse(getCat[0]?.val)?.forEach((item, indexPoint) => {
    pointCategory += `${item.category} : ${item.all_point}/${item.maxPoint} ${
      indexPoint === JSON.parse(getCat[0]?.val).length - 1 ? '' : '\n'
    }`;
  });

  worksheet.addRow({
    ...user,
    posisi: index + 1,
    createdAt: moment(user.createdAt).format('DD-MM-YYYY HH:mm'),
    waktuPengerjaan: konversiDetikKeWaktu(user.waktuPengerjaan),
    point: `${user.point}/${user.maxPoint}`,
    pointCategory,
  });

  // Process the next user recursively
  await processUser(users, index + 1, worksheet);
};

const excel = async (req, res, next) => {
  try {
    const schema = Joi.object({
      skip: Joi.number(),
      take: Joi.number(),
      sortBy: Joi.string(),
      descending: Joi.boolean(),
      filters: Joi.object(),
      paketLatihanId: Joi.number(),
      paketPembelianTryoutId: Joi.number(),
    });

    const validate = await schema.validateAsync(req.query);

    const workbook = new excelJS.Workbook();
    const worksheet = workbook.addWorksheet('Users');

    worksheet.columns = [
      { header: 'Posisi', key: 'posisi', width: 15 },
      { header: 'Nama User', key: 'name', width: 15 },
      { header: 'Email', key: 'email', width: 15 },
      { header: 'Nomor Telepon', key: 'noWA', width: 15 },
      {
        header: 'Nilai Per Kategori',
        key: 'pointCategory',
        width: 20,
      },
      {
        header: 'Nilai',
        key: 'point',
        width: 15,
      },
      {
        header: 'Waktu Pengerjaan',
        key: 'waktuPengerjaan',
        width: 15,
      },
      {
        header: 'Tanggal Tryout',
        key: 'createdAt',
        width: 15,
      },
    ];

    const result = await database.$queryRaw`SELECT
        t.id,
        t.userId,
        t.paketLatihanId,
        u.name,
        u.email,
        u.noWA,
        COALESCE(SUM(ts.point)) AS point,
        t.kkm,
        t.maxPoint,
        t.finishAt,
        t.createdAt,
        t.updatedAt,
        t.waktuPengerjaan
    FROM (
        SELECT
            t.id,
            t.userId,
            t.paketLatihanId,
            t.kkm,
            t.maxPoint,
            t.finishAt,
            t.createdAt,
            t.updatedAt,
            t.waktuPengerjaan,
            t.paketPembelianTryoutId,
            ROW_NUMBER() OVER (PARTITION BY t.userId ORDER BY t.createdAt) as row_num
        FROM Tryout t
        WHERE t.paketLatihanId = ${validate.paketLatihanId} AND t.paketPembelianTryoutId = ${validate.paketPembelianTryoutId}
    ) t
    LEFT JOIN TryoutSoal ts ON t.id = ts.tryoutId
    LEFT JOIN User u ON t.userId = u.id
    WHERE t.row_num = 1 AND t.paketLatihanId = ${validate.paketLatihanId} AND t.paketPembelianTryoutId = ${validate.paketPembelianTryoutId}
    GROUP BY
        t.id, t.userId, t.paketLatihanId, u.name, t.kkm, t.maxPoint, t.finishAt, t.createdAt, t.updatedAt
    ORDER BY
    point DESC;`;

    await processUser(result, 0, worksheet); // Start processing users recursively

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', 'attachment; filename=tryout.xlsx');

    workbook.xlsx.write(res).then(() => res.end());
  } catch (error) {
    next(error);
  }
};

const insert = async (req, res, next) => {
  try {
    const schema = Joi.object({
      paketPembelianId: Joi.number().required(),
      limit: Joi.number().required().allow(0, '').default(0),
      paketLatihanId: Joi.number().required(),
      isRandomQuestion: Joi.boolean().allow(null, ''),

      type: Joi.string()
        .valid('TRYOUT', 'PENDAHULUAN', 'PEMANTAPAN', 'LATIHAN')
        .required(),
      startDate: Joi.string().allow(null, ''),
      endDate: Joi.string().allow(null, ''),
      category: Joi.string().allow(null, ''),
    });

    const validate = await schema.validateAsync(req.body);

    const result = await database.paketPembelianTryout.create({
      data: {
        ...validate,
        limit: validate.limit || 0,
        startDate: validate.startDate
          ? moment(validate.startDate, formatDate)
          : null,
        endDate: validate.endDate ? moment(validate.endDate, formatDate) : null,
      },
    });

    res.status(200).json({
      data: result,
      msg: 'Berhasil menambahkan Tryout',
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
      limit: Joi.number().required().allow(0, '').default(0),
      isRandomQuestion: Joi.boolean().allow(null, ''),
      startDate: Joi.string().allow(null, ''),
      endDate: Joi.string().allow(null, ''),

      paketLatihanId: Joi.number().required(),
      type: Joi.string()
        .valid('TRYOUT', 'PENDAHULUAN', 'PEMANTAPAN', 'LATIHAN')
        .required(),
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

    const isExist = await database.paketPembelianTryout.findUnique({
      where: {
        id: validate.id,
      },
    });

    if (!isExist) throw new BadRequestError('Tryout tidak ditemukan');

    const result = await database.paketPembelianTryout.update({
      where: {
        id: validate.id,
      },
      data: {
        ...validate,
        limit: validate.limit || 0,
        startDate: validate.startDate
          ? moment(validate.startDate, formatDate)
          : null,
        endDate: validate.endDate ? moment(validate.endDate, formatDate) : null,
      },
    });

    res.status(200).json({
      data: result,
      msg: 'Berhasil mengubah Tryout',
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

    const isExist = await database.paketPembelianTryout.findUnique({
      where: {
        id: validate.id,
      },
    });

    if (!isExist) throw new BadRequestError('Fitur tidak ditemukan');

    const result = await database.paketPembelianTryout.delete({
      where: {
        id: validate.id,
      },
    });

    res.status(200).json({
      data: result,
      msg: 'Berhasil menghapus tryout',
    });
  } catch (error) {
    next(error);
  }
};
const getHistory = async (req, res, next) => {
  try {
    const schema = Joi.object({
      skip: Joi.number(),
      take: Joi.number(),
      sortBy: Joi.string(),
      descending: Joi.boolean(),
      filters: Joi.object(),
      id: Joi.number(),
      paketPembelianTryoutId: Joi.number().allow(null),
    }).unknown(true);

    const validate = await schema.validateAsync(req.query);
    const result = [];
    result[0] = await database.$queryRaw`SELECT
        t.id,
        t.userId,
        t.paketLatihanId,
        JSON_OBJECT(
            '_sum', JSON_OBJECT('point', COALESCE(SUM(ts.point), 0))
        ) AS point,
        t.kkm,
        t.maxPoint,
        t.finishAt,
        t.createdAt,
        t.updatedAt,
        pl.isShareAnswer,
        t.waktuPengerjaan,
        u.name,
        u.noWA,
        u.email
    FROM
        Tryout t
    LEFT JOIN
        TryoutSoal ts ON t.id = ts.tryoutId
    LEFT JOIN
        User u ON t.userId = u.id
    LEFT JOIN PaketLatihan pl ON t.paketLatihanId = pl.id
    WHERE
       t.paketLatihanId = ${validate.id} AND t.paketPembelianTryoutId = ${validate.paketPembelianTryoutId}
    GROUP BY
        t.id, t.userId, t.paketLatihanId, t.kkm, t.maxPoint, t.finishAt, t.createdAt, t.updatedAt
    ORDER BY
        t.createdAt DESC
    LIMIT ${validate.take}
    OFFSET ${validate.skip};`;

    await result[0].forEach(async (e) => {
      const getCat = await database.$queryRaw`
         (
        SELECT
            JSON_ARRAYAGG(
                JSON_OBJECT(
                    'category', subquery.category,
                    'kkm', subquery.kkm,
                    'maxPoint', subquery.maxPoint,
                    'all_point', COALESCE(subquery.all_point, 0)
                )
            ) as val
        FROM (
            SELECT
                ts.category,
                ts.kkm,
                ts.maxPoint,
                COALESCE(SUM(ts.point), 0) AS all_point
            FROM TryoutSoal ts
            WHERE ts.tryoutId = ${e.id}
            GROUP BY ts.category, ts.kkm, ts.maxPoint
        ) subquery
    )`;
      // e.pointCategory = getCat[0]?.val ? getCat[0]?.val : [];

      e.pointCategory = getCat[0]?.val ? JSON?.parse(getCat[0]?.val) : [];
    });
    result[1] =
      (await database.tryout.count({
        where: {
          paketLatihanId: validate.id,
          paketPembelianTryoutId: validate.paketPembelianTryoutId,
        },
      })) || 0;

    return returnPagination(req, res, result);
  } catch (error) {
    next(error);
  }
};
const excelTryout = async (req, res, next) => {
  try {
    const schema = Joi.object({
      id: Joi.number(),
    });

    const validate = await schema.validateAsync(req.query);

    const workbook = new excelJS.Workbook();
    const worksheet = workbook.addWorksheet('Users');

    worksheet.columns = [
      { header: 'No', key: 'no', width: 8 },
      { header: 'Kategori', key: 'category', width: 15 },
      { header: 'Soal', key: 'soal', width: 15 },
      { header: 'Pembahasan', key: 'pembahasan', width: 15 },
      { header: 'Jawaban Kamu', key: 'jawaban-kamu', width: 15 },
      { header: 'Jawaban Benar', key: 'jawaban-benar', width: 15 },
      {
        header: 'A',
        key: 'a',
        width: 15,
      },
      {
        header: 'B',
        key: 'b',
        width: 15,
      },
      {
        header: 'C',
        key: 'c',
        width: 15,
      },
      {
        header: 'D',
        key: 'd',
        width: 15,
      },
      {
        header: 'Point',
        key: 'point',
        width: 8,
      },
    ];
    const result = await database.tryout.findUnique({
      where: {
        id: validate.id,
      },
      include: {
        TryoutSoal: {
          select: {
            id: true,
            category: true,
            point: true,
            isCorrect: true,
            jawaban: true,
            soal: true,
            maxPoint: true,
            jawabanSelect: true,
            pembahasan: true,
          },
        },
      },
    });
    result?.TryoutSoal?.forEach((item, index) => {
      // console.log(first);
      worksheet.addRow({
        ...item,
        no: index + 1,
        soal: convert(item.soal),
        pembahasan: convert(item.pembahasan),
        point: `${item.point}`,
        'jawaban-benar': getIndexAnswer(item.jawabanSelect, item.jawaban),
        'jawaban-kamu': getIndexSelectedAnswer(item.jawaban),
        a: convert(JSON.parse(item.jawaban)?.[0].jawaban),
        b: convert(JSON.parse(item.jawaban)?.[1].jawaban),
        c: convert(JSON.parse(item.jawaban)?.[2].jawaban),
        d: convert(JSON.parse(item.jawaban)?.[3].jawaban),
      });
    });
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', 'attachment; filename=tryout.xlsx');

    workbook.xlsx.write(res).then(() => res.end());
  } catch (error) {
    next(error);
  }
};

module.exports = {
  get,
  insert,
  update,
  remove,
  excel,
  excelTryout,
  getHistory,
  find,
};
