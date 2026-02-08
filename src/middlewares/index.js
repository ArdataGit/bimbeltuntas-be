const Auth = require('./auth');

module.exports = {
  authenticateUser: Auth.authenticateUser,
  authorizeRoles: Auth.authorizeRoles,
};
