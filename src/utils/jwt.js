const jwt = require('jsonwebtoken');
const { UnauthenticatedError } = require('#errors');

const isTokenValid = ({ token }) => {
  try {
    // Verifikasi token dengan secret yang sesuai
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    // Tangani error verifikasi token
    console.error('Invalid token:', error.message);
    throw new UnauthenticatedError('JWT Version not valid');

    // return null; // Atau Anda bisa melempar error khusus untuk kasus ini
  }
};

const generateToken = (payload, exp) => {
  const result = {
    id: payload.id,
    email: payload.email,
    jwtVersion: payload.jwtVersion,
  };
  return jwt.sign(result, process.env.JWT_SECRET, {
    expiresIn: exp || '20d',
  });
};

module.exports = {
  isTokenValid,
  generateToken,
};
