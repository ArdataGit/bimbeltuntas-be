const returnPagination = (req, res, result) => {
  res.status(200).json({
    data: {
      list: result[0],
      pagination: {
        total: result[1].toString(),
        skip: Number(req.body.skip || req.query.skip),
        take: Number(req.body.take || req.query.take),
        currentTotal: result[0].length,
      },
    },
    msg: 'Get all data',
  });
};

module.exports = returnPagination;
