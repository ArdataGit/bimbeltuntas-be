const crypto = require("crypto");

const generateUniqueINV = () => {
  return `INV-${crypto.randomUUID()}`;
};

module.exports = generateUniqueINV;
