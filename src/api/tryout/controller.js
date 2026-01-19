const Joi = require('joi');
const moment = require('moment');
const database = require('#database');
const {
  getBankSoal,
  queryGetNilaiByCat,
  countAllMaxPoint,
  filterToJson,
  returnPagination,
} = require('#utils');
const { BadRequestError } = require('#errors');

const checkActive = async (req, res, next) => {
  try {
    const result = await database.tryout.findFirst({
      where: {
        userId: req?.user?.id,
        finishAt: {
          gt: new Date(),
        },
      },
      include: {
        paketLatihan: true,
        paketPembelianBimbel: true,
        paketPembelianTryout: true,
      },
    });

    res.status(200).json({
      data: result,
      msg: 'Berhasil Mendapatkan Data',
    });
  } catch (error) {
    console.log(error);
    next(error);
  }
};
const start = async (req, res, next) => {
  try {
    const schema = Joi.object({
      paketLatihanId: Joi.number().required(),
      paketPembelianTryoutId: Joi.number().allow(null),
      paketPembelianBimbelId: Joi.number().allow(null),
    });
    const validate = await schema.validateAsync(req.body);

    const getPaketLatihan = await database.paketLatihan.findUnique({
      where: {
        id: validate.paketLatihanId,
      },
      select: {
        id: true,
        nama: true,
        waktu: true,
        kkm: true,
      },
    });

    const where = {}
    if (validate.paketPembelianTryoutId) {
      where.id = validate.paketPembelianTryoutId
    } else {
      where.paketPembelianId = validate.paketPembelianBimbelId
    }

    const checkLimitTryout = await database.paketPembelianTryout.findFirst({
      where: where,      select: {
        limit: true,
        startDate: true,
        endDate: true,
        isRandomQuestion: true,
      },
    });

    if (checkLimitTryout && moment().isBefore(checkLimitTryout.startDate)) {
      throw new BadRequestError('Tryout belum dimulai');
    }

    if (checkLimitTryout && moment().isAfter(checkLimitTryout.endDate)) {
      throw new BadRequestError('Tryout telah berakhir');
    }

    const checkMyLimitTryout = await database.tryout.count({
      where: {
        userId: req.user.id,
        paketPembelianTryoutId: validate.paketPembelianTryoutId,
      },
    });

    if (
      checkLimitTryout?.limit &&
      checkMyLimitTryout >= checkLimitTryout?.limit
    ) {
      throw new BadRequestError('Sudah mencapai batas limit tryout');
    }

    const getPaketLatihanSoal = await database.paketLatihanSoal.findMany({
      where: {
        paketLatihanId: validate.paketLatihanId,
      },
      select: {
        isRandomQuestion: true,
        bankSoalCategory: {
          select: {
            BankSoal: {
              select: {
                id: true,
                soal: true,
                pembahasan: true,
                subCategory: true,
                category: {
                  select: {
                    id: true,
                    nama: true,
                    keterangan: true,
                    tipePenilaian: true,
                    kkm: true,
                  },
                },
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
        },
      },
    });

    const result = await database.tryout.create({
      data: {
        paketLatihan: {
          connect: {
            id: validate.paketLatihanId,
          },
        },
        user: {
          connect: {
            id: req.user.id,
          },
        },
        kkm: getPaketLatihan.kkm,
        waktuPengerjaan: getPaketLatihan.waktu * 60,
        maxPoint: countAllMaxPoint(getPaketLatihanSoal),
        paketPembelianTryout: validate.paketPembelianTryoutId && {
          connect: {
            id: validate.paketPembelianTryoutId,
          },
        },
        paketPembelianBimbel: validate.paketPembelianBimbelId && {
          connect: {
            id: validate.paketPembelianBimbelId,
          },
        },
        finishAt: new Date(
          new Date().getTime() + getPaketLatihan.waktu * 60000
        ),
      },
    });
    console.log(checkLimitTryout);
    // isRandomQuestion
    const allSoal = await getBankSoal(getPaketLatihanSoal, result.id);

    await database.tryoutSoal.createMany({
      data: allSoal,
    });

    res.status(200).json({
      data: result,
      msg: 'Berhasil Memulai',
    });
  } catch (error) {
    next(error);
  }
};
const getMyTryout = async (req, res, next) => {
  try {
    const schema = Joi.object({
      skip: Joi.number(),
      take: Joi.number(),
      sortBy: Joi.string(),
      descending: Joi.boolean(),
      filters: Joi.object(),
      category: Joi.string().allow(null, ''),
    });

    const validate = await schema.validateAsync(req.query);

    const take = validate.take ? { take: validate.take } : {};
    const where = {
      ...filterToJson(validate),
      isActive: true,
      paketPembelianCategory: validate.category
        ? {
            some: {
              nama: {
                contains: validate.category,
              },
            },
          }
        : null,
    };

    if (!where.paketPembelianCategory) delete where.paketPembelianCategory;
    const result = await database.$transaction([
      database.paketPembelian.findMany({
        ...take,
        skip: validate.skip,
        orderBy: {
          [validate.sortBy]: validate.descending ? 'desc' : 'asc',
        },
        where,
        select: {
          id: true,
          nama: true,
          harga: true,
          keterangan: true,
          durasi: true,
          createdAt: true,
          gambar: true,
          requirement: true,
          paketPembelianCategory: {
            select: {
              nama: true,
            },
          },

          paketPembelianFitur: {
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
              Pembelian: {
                where: {
                  userId: req.user.id,
                  status: 'PAID',
                },
              },
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

const answer = async (req, res, next) => {
  try {
    const schema = Joi.object({
      soalId: Joi.number().required(),
      tryoutId: Joi.number().required(),
      jawabanSelect: Joi.number().required().allow(null),
    });
    const validate = await schema.validateAsync(req.body);

    const getTryout = await database.tryout.findUnique({
      where: {
        id: validate.tryoutId,
        userId: req.user.id,
        finishAt: {
          gt: new Date(),
        },
      },
      select: {
        TryoutSoal: {
          where: {
            id: validate.soalId,
          },
        },
      },
    });

    if (!getTryout) throw new BadRequestError('Waktu Telah habis');
    const pointAnswer = JSON.parse(getTryout.TryoutSoal?.[0].jawaban);

    await database.tryoutSoal.update({
      where: {
        id: validate.soalId,
      },
      data: {
        jawabanSelect: validate.jawabanSelect,
        isCorrect:
          pointAnswer.find((e) => e.id === validate.jawabanSelect)?.isCorrect ||
          false,
        point:
          pointAnswer.find((e) => e.id === validate.jawabanSelect)?.point || 0,
      },
    });

    res.status(200).json({
      data: {
        id: validate.soalId,
      },
      msg: 'Berhasil Memulai',
    });
  } catch (error) {
    next(error);
  }
};

const markAsIsRaguRagu = async (req, res, next) => {
  try {
    const schema = Joi.object({
      soalId: Joi.number().required(),
      tryoutId: Joi.number().required(),
      value: Joi.boolean().required(),
    });

    const validate = await schema.validateAsync(req.body);

    const getTryout = await database.tryout.findUnique({
      where: {
        id: validate.tryoutId,
        userId: req.user.id,
        finishAt: {
          gt: new Date(),
        },
      },
      select: {
        TryoutSoal: {
          where: {
            id: validate.soalId,
          },
        },
      },
    });

    if (!getTryout) throw new BadRequestError('Waktu Telah habis');

    await database.tryoutSoal.update({
      where: {
        id: validate.soalId,
      },
      data: {
        isRaguRagu: validate.value,
      },
    });

    res.status(200).json({
      data: {
        id: validate.soalId,
      },
      msg: 'Berhasil Memulai',
    });
  } catch (error) {
    next(error);
  }
};

const finish = async (req, res, next) => {
  try {
    const schema = Joi.object({
      tryoutId: Joi.number().required(),
    });
    const validate = await schema.validateAsync(req.body);

    const getTryout = await database.tryout.findFirst({
      where: {
        id: validate.tryoutId,
        userId: req.user.id,
      },
    });

    if (!getTryout) throw new BadRequestError('Data tidak ditemukan');

    await database.tryout.update({
      where: {
        id: validate.tryoutId,
      },
      data: {
        waktuPengerjaan: moment().diff(getTryout.createdAt, 'seconds'),
        finishAt: new Date(),
      },
    });

    res.status(200).json({
      data: {
        ...getTryout,
        point: await database.tryoutSoal.aggregate({
          where: {
            tryoutId: validate.tryoutId,
          },
          _sum: {
            point: true,
          },
        }),
        pointCategory: await queryGetNilaiByCat(validate.tryoutId, req.user.id),
      },
      msg: 'Berhasil Memulai',
    });
  } catch (error) {
    next(error);
  }
};
const history = async (req, res, next) => {
  try {
    const schema = Joi.object({
      skip: Joi.number(),
      take: Joi.number(),
      sortBy: Joi.string(),
      descending: Joi.boolean(),
      filters: Joi.object(),
      id: Joi.number(),
      paketPembelianTryoutId: Joi.number().allow(null),
      paketPembelianBimbelId: Joi.number().allow(null),
    });

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
        t.waktuPengerjaan
    FROM
        Tryout t
    LEFT JOIN
        TryoutSoal ts ON t.id = ts.tryoutId
    LEFT JOIN PaketLatihan pl ON t.paketLatihanId = pl.id
    WHERE
       t.userId = ${req?.user?.id} AND t.paketLatihanId = ${validate.id} AND (t.paketPembelianTryoutId = ${validate.paketPembelianTryoutId} OR t.paketPembelianBimbelId = ${validate.paketPembelianBimbelId})
    GROUP BY
        t.id, t.userId, t.paketLatihanId, t.kkm, t.maxPoint, t.finishAt, t.createdAt, t.updatedAt
    ORDER BY
        t.createdAt DESC
    LIMIT ${validate.take}
    OFFSET ${validate.skip};`;

    await Promise.all(
      result[0].map(async (e) => {
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

        //e.pointCategory = getCat[0]?.val ? getCat[0]?.val : [];
        const val = getCat[0]?.val;
        e.pointCategory = val
          ? typeof val === 'string'
            ? JSON.parse(val)
            : val
          : [];
      })
    );

    result[1] =
      (await database.tryout.count({
        where: {
          userId: req?.user?.id,
          paketLatihanId: validate.id,
          paketPembelianTryoutId: validate.paketPembelianTryoutId,
        },
      })) || 0;

    return returnPagination(req, res, result);
  } catch (error) {
    next(error);
  }
};
const ranking = async (req, res, next) => {
  try {
    const schema = Joi.object({
      skip: Joi.number(),
      take: Joi.number(),
      sortBy: Joi.string(),
      descending: Joi.boolean(),
      filters: Joi.object(),
      id: Joi.number(),
      paketPembelianTryoutId: Joi.number().allow(null),
      paketPembelianBimbelId: Joi.number().allow(null),
    });

    const validate = await schema.validateAsync(req.query);
    const result = [];

    const getAll = await database.$queryRaw`SELECT
        t.id,
        t.userId,
        t.paketLatihanId,
        u.name,
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
            t.paketPembelianBimbelId,
            ROW_NUMBER() OVER (PARTITION BY t.userId ORDER BY t.createdAt) as row_num
        FROM Tryout t
        WHERE t.paketLatihanId = ${validate.id} AND (t.paketPembelianTryoutId = ${validate.paketPembelianTryoutId} OR t.paketPembelianBimbelId = ${validate.paketPembelianBimbelId})
    ) t
    LEFT JOIN User u ON t.userId = u.id
    LEFT JOIN TryoutSoal ts ON t.id = ts.tryoutId
    WHERE t.row_num = 1 AND t.paketLatihanId = ${validate.id} AND (t.paketPembelianTryoutId = ${validate.paketPembelianTryoutId} OR t.paketPembelianBimbelId = ${validate.paketPembelianBimbelId})
    GROUP BY
        t.id, t.userId, t.paketLatihanId, u.name, t.kkm, t.maxPoint, t.finishAt, t.createdAt, t.updatedAt
    ORDER BY
        point DESC
    LIMIT ${validate.take}
    OFFSET ${validate.skip};`;

    await Promise.all(
      getAll.map(async (e) => {
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
        const val = getCat[0]?.val;
        e.pointCategory = val
          ? typeof val === 'string'
            ? JSON.parse(val)
            : val
          : [];
      })
    );

    const count = await database.$queryRaw`
      SELECT COUNT(*) AS total FROM (
          SELECT
              t.id,
              t.userId,
              t.paketLatihanId,
              u.name,
              COALESCE(SUM(ts.point), 0) AS point,
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
              WHERE t.paketLatihanId = ${validate.id} AND t.paketPembelianTryoutId = ${validate.paketPembelianTryoutId}
          ) t
          LEFT JOIN TryoutSoal ts ON t.id = ts.tryoutId
          LEFT JOIN User u ON t.userId = u.id
          WHERE t.row_num = 1 AND t.paketLatihanId = ${validate.id} AND t.paketPembelianTryoutId = ${validate.paketPembelianTryoutId}
          GROUP BY
              t.id, t.userId, t.paketLatihanId, u.name, t.kkm, t.maxPoint, t.finishAt, t.createdAt, t.updatedAt
      ) AS subqueryCount;
      `;

    result[0] = getAll;
    result[1] = count[0].total;
    return returnPagination(req, res, result);
  } catch (error) {
    next(error);
  }
};
const statistic = async (req, res, next) => {
  try {
    const schema = Joi.object({
      id: Joi.number().required(),
    });
    const validate = await schema.validateAsync(req.query);
    const result = await database.$queryRaw`SELECT
    t.id,
    t.userId,
    t.paketLatihanId,
    u.name,
    COALESCE(SUM(ts.point), 0) AS point,
    t.kkm,
    t.maxPoint,
    t.finishAt,
    t.createdAt,
    t.updatedAt,
    t.waktuPengerjaan,
    (
        SELECT
            CONCAT('[', IFNULL(GROUP_CONCAT(
               JSON_OBJECT(
                'category', subquery.category,
                'point1', COALESCE(subquery.point1, 0),
                'point2', COALESCE(subquery.point2, 0),
                'point3', COALESCE(subquery.point3, 0),
                'point4', COALESCE(subquery.point4, 0),
                'point5', COALESCE(subquery.point5, 0),
                'tipe_penilaian', subquery.tipePenilaian,
                'kkm', subquery.kkm,
                'maxPoint', subquery.maxPoint,
                'all_point', COALESCE(subquery.all_point, 0),
                'answer_right', COALESCE(subquery.isCorrect, 0),
                'answer_wrong', COALESCE(subquery.isWrong, 0),
                'not_answer', COALESCE(subquery.isNotAnswer, 0),
                'count_soal', COALESCE(subquery.countSoal, 0),
                'subCategory', subquery.subCategory
            )
            ), ''), ']')
        FROM (
            SELECT
                ts.category,
                SUM(CASE WHEN ts.point = 1 THEN 1 ELSE 0 END) AS point1,
                SUM(CASE WHEN ts.point = 2 THEN 1 ELSE 0 END) AS point2,
                SUM(CASE WHEN ts.point = 3 THEN 1 ELSE 0 END) AS point3,
                SUM(CASE WHEN ts.point = 4 THEN 1 ELSE 0 END) AS point4,
                SUM(CASE WHEN ts.point = 5 THEN 1 ELSE 0 END) AS point5,
                ts.tipePenilaian,
                ts.kkm,
                ts.maxPoint,
                COALESCE(SUM(ts.point), 0) AS all_point,
                SUM(CASE WHEN ts.isCorrect = 1 THEN 1 ELSE 0 END) AS isCorrect,
                SUM(CASE WHEN ts.isCorrect = 0 THEN 1 ELSE 0 END) AS isWrong,
                SUM(CASE WHEN ts.jawabanSelect IS NULL THEN 1 ELSE 0 END) AS isNotAnswer,
                COUNT(ts.id) AS countSoal,
                JSON_ARRAYAGG(
                    JSON_OBJECT(
                        'subcategory', ts.subCategory,
                        'duration', ts.duration,
                        'correct', isCorrect,
                        'point', ts.point
                    )
                ) AS subCategory
            FROM TryoutSoal ts
            LEFT JOIN Tryout t ON t.id = ts.tryoutId
            WHERE t.id = ${validate.id}
            GROUP BY ts.category, ts.kkm, ts.maxPoint, ts.tipePenilaian
        ) subquery
    ) AS pointCategory
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
        ROW_NUMBER() OVER (PARTITION BY t.userId ORDER BY t.createdAt) as row_num
    FROM Tryout t
) t
LEFT JOIN TryoutSoal ts ON t.id = ts.tryoutId
LEFT JOIN User u ON t.userId = u.id
WHERE t.id = ${validate.id}
GROUP BY
    t.id, t.userId, t.paketLatihanId, u.name, t.kkm, t.maxPoint, t.finishAt, t.createdAt, t.updatedAt
ORDER BY
    point DESC;



`;

    res.status(200).json({
      data: {
        ...result[0],
        pointCategory: result[0]?.pointCategory
          ? JSON.parse(result[0]?.pointCategory)
          : [],
      },
      msg: 'Berhasil Mendapatkan Data',
    });
  } catch (error) {
    next(error);
  }
};

const addDuration = async (req, res, next) => {
  try {
    const schema = Joi.object({
      id: Joi.number().required(),
      duration: Joi.number().required(),
    });

    const validate = await schema.validateAsync(req.body);
    await database.tryoutSoal.update({
      where: { id: validate.id },
      data: { duration: { increment: validate.duration } },
    });

    res.status(200).json({
      data: '',
      msg: 'Berhasil Mengubah data',
    });
  } catch (error) {
    next(error);
  }
};
module.exports = {
  start,
  answer,
  finish,
  history,
  getMyTryout,
  ranking,
  statistic,
  checkActive,
  addDuration,
  markAsIsRaguRagu,
};
