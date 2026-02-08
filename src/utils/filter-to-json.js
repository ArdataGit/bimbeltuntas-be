const moment = require('moment');

const filterToJson = (validate) => {
  if (!validate.filters) return {};

  const result = Object.keys(validate.filters).reduce((acc, key) => {
    // Handle 'createdAt' range filter
    if (key === 'createdAt' && Array.isArray(validate.filters[key])) {
      acc[key] = {
        gte: moment(validate.filters?.createdAt[0]).toDate(),
        lte: moment(validate.filters?.createdAt[1])
          .set('hour', 23)
          .set('minute', 59)
          .set('second', 59)
          .toDate(),
      };
      return acc;
    }

    // Handle 'hasPurchase' filter
    if (key === 'hasPurchase') {
      if (validate.filters[key] === true) {
        acc.Pembelian = {
          some: {}, // Memastikan user memiliki pembelian
        };
      } else if (validate.filters[key] === false) {
        acc.Pembelian = {
          none: {}, // Memastikan user tidak memiliki pembelian
        };
      }
      return acc;
    }

    // Handle 'packageId' filter
    if (key === 'packageId') {
      acc.Pembelian = {
        some: {
          paketPembelianId: parseInt(validate.filters[key], 10), // Filter berdasarkan packageId
        },
      };
      return acc;
    }

    // Default filter for other fields (e.g., string contains)
    acc[key] = {
      contains: validate.filters[key],
    };

    return acc;
  }, {});

  return { ...result };
};

module.exports = filterToJson;
