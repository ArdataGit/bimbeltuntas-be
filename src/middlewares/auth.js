const { UnauthenticatedError, UnauthorizedError } = require('../errors');
const { isTokenValid } = require('#utils');
const database = require('#database');

const authenticateUser = async (req, res, next) => {
  try {
    let token;

    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer')) {
      token = authHeader.replace('Bearer ', '');
    }

    if (!token) throw new UnauthenticatedError('Authentication invalid');

    const payload = isTokenValid({ token });

    const user = await database.User.findUnique({
      where: {
        id: payload.id,
      },
    });

    if (!user) throw new UnauthenticatedError('Authentication: User not found');

    if (user.role === 'USER') {
      if (payload.jwtVersion !== user.jwtVersion) {
        throw new UnauthenticatedError('JWT Version not valid');
      }
    }

    req.user = {
      id: user.id,
      role: user.role,
      email: user.email,
      noWA: user.noWA,
      name: user.name,
    };
    next();
  } catch (error) {
    next(error);
  }
};

const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      throw new UnauthorizedError('Unauthorized to access this route');
    }
    next();
  };
};

module.exports = {
  authenticateUser,
  authorizeRoles,
};
