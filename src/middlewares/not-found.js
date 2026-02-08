const { StatusCodes } = require('http-status-codes');

const errorHandlerMiddleware = (err, req, res, next) => {
  console.log(err);
  let customError = {
    statusCode: err.statusCode || StatusCodes.INTERNAL_SERVER_ERROR,
    msg: err.message || 'Internal Server Error',
  };

  // if (err.name === 'SequelizeValidationError') {
  //   customError.msg = Object.values(err.errors)
  //     .map((item) => item.message)
  //     .join(', ');
  //   customError.statusCode = 400;
  // }
  // return res.status(customError.statusCode).json({ msg: customError.msg });
  if (err.message.includes('Unknown nested field')) {
    const regexResult =
      /Unknown nested field '(.+?)' for operation (.+?) does not match any query\./.exec(
        err.message
      );
    if (regexResult) {
      customError.msg = `Invalid query in ${regexResult[2]}: Unknown nested field '${regexResult[1]}'.`;
      // customError.statusCode = 400; // You can set a specific status code for this case
    }
  }

  return res.status(customError.statusCode).json({ msg: customError.msg });
};

module.exports = errorHandlerMiddleware;
