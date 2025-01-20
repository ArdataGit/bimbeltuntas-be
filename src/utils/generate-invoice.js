const generateUniqueINV = () => {
  const invoice = `INV-${Math.floor(Math.random() * 10 ** 7)
    .toString()
    .padStart(7, '0')}`;

  return invoice;
};
module.exports = generateUniqueINV;
