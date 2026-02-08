const bcrypt = require('bcryptjs');
const Joi = require('joi');

const { StatusCodes } = require('http-status-codes');
const { BadRequestError } = require('../../errors');

const database = require('#database');
const { generateToken, sendMail, isTokenValid } = require('#utils');

const register = async (req, res, next) => {
  const schema = Joi.object({
    name: Joi.string().min(3).max(30).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(8).required(),
    noWA: Joi.string(),
  });

  try {
    const validate = await schema.validateAsync(req.body);

    const isEmailExist = await database.User.findUnique({
      where: {
        email: validate.email,
      },
    });

    if (isEmailExist) throw new BadRequestError('Email telah digunakan');

    const isNoWAExist = await database.User.findFirst({
      where: {
        noWA: validate.noWA,
      },
    });

    if (isNoWAExist) throw new BadRequestError('No Whatsapp telah digunakan');

    const user = await database.User.create({
      data: {
        ...validate,
        password: bcrypt.hashSync(validate.password, 10),
      },
    });

    // const token = generateToken(user);

    sendMail({
      to: validate.email,
      subject: 'Selamat Datang di Tuntas CBT UKAI',
      template: 'welcome.html',
      name: validate.name,
      url: `${process.env.URL_CLIENT}`,
      email: validate.email,
      password: validate.password,
    });

    res.status(StatusCodes.CREATED).json({
      data: user,
      msg: 'User created',
    });
  } catch (error) {
    next(error);
  }
};

//login satu akun hanya untuk satu device
// const login = async (req, res, next) => {
//   try {
//     const schema = Joi.object({
//       email: Joi.string().email().required(),
//       password: Joi.string().min(8).required(),
//     });

//     const validate = await schema.validateAsync(req.body);

//     const user = await database.User.findUnique({
//       where: {
//         email: validate.email,
//       },
//     });

//     if (!user) throw new BadRequestError('Email belum terdaftar');

//     const checkPassword = bcrypt.compareSync(validate.password, user.password);

//     if (!checkPassword) throw new BadRequestError('Password salah');

//     // if (!user.verifyAt) {
//     //   throw new BadRequestError('Silahkan verifikasi email anda');
//     // }

//     await database.User.update({
//       where: {
//         id: user.id,
//       },
//       data: {
//         jwtVersion: {
//           increment: 1,
//         },
//       },
//     });

//     user.jwtVersion += 1;
//     const token = generateToken(user);

//     res.status(StatusCodes.OK).json({
//       data: {
//         token,
//         user,
//       },
//       msg: 'Login Berhasil',
//     });
//   } catch (error) {
//     next(error);
//   }
// };

const login = async (req, res, next) => {
  try {
    const schema = Joi.object({
      email: Joi.string().email().required(),
      password: Joi.string().min(8).required(),
    });
    const validate = await schema.validateAsync(req.body);
    const user = await database.User.findUnique({
      where: {
        email: validate.email,
      },
    });
    if (!user) throw new BadRequestError('Email belum terdaftar');
    const checkPassword = bcrypt.compareSync(validate.password, user.password);
    if (!checkPassword) throw new BadRequestError('Password salah');
    // if (!user.verifyAt) {
    // throw new BadRequestError('Silahkan verifikasi email anda');
    // }
    // Hapus bagian increment jwtVersion di sini
    const token = generateToken(user);  // Token baru dibuat tanpa invalidasi yang lama
    res.status(StatusCodes.OK).json({
      data: {
        token,
        user,
      },
      msg: 'Login Berhasil',
    });
  } catch (error) {
    next(error);
  }
};

const confirmEmail = async (req, res, next) => {
  try {
    const { token } = req.params;

    const decodeToken = isTokenValid({ token });

    const user = await database.User.findUnique({
      where: {
        id: decodeToken.id,
      },
    });

    if (!user) throw new BadRequestError('Token tidak valid');

    await database.User.update({
      where: {
        id: decodeToken.id,
      },
      data: {
        verifyAt: new Date(),
      },
    });

    res.redirect(`${process.env.URL_CLIENT}/auth/login`);
  } catch (error) {
    next(error);
  }
};

const forgotPassword = async (req, res, next) => {
  try {
    const schema = Joi.object({
      email: Joi.string().email().required(),
    });

    const validate = await schema.validateAsync(req.body);

    const user = await database.User.findUnique({
      where: {
        email: validate.email,
      },
    });

    if (!user) throw new BadRequestError('Email belum terdaftar');

    const token = generateToken(user, '15m');

    const sendEmail = await sendMail({
      to: user.email,
      subject: 'Reset Password',
      template: 'forgot-password.html',
      name: user.name,
      url: `${process.env.URL_CLIENT}/auth/reset-password/${token}`,
    });

    if (sendEmail) {
      res.status(StatusCodes.OK).json({
        msg: 'Email reset password telah dikirim',
      });
    } else {
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        msg: 'Gagal mengirim email, hubungi admin',
      });
    }
  } catch (error) {
    next(error);
  }
};

const resetPassword = async (req, res, next) => {
  try {
    const schema = Joi.object({
      password: Joi.string().min(8).required(),
      token: Joi.string().required(),
    });

    const validate = await schema.validateAsync(req.body);
    const decodeToken = isTokenValid({ token: validate.token });

    await database.User.update({
      where: {
        id: decodeToken.id,
      },
      data: {
        password: bcrypt.hashSync(validate.password, 10),
      },
    });

    res.status(StatusCodes.OK).json({
      msg: 'Password berhasil diubah',
    });
  } catch (error) {
    next(error);
  }
};
module.exports = {
  register,
  login,
  forgotPassword,
  resetPassword,
  confirmEmail,
};
