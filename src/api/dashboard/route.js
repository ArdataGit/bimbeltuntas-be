const express = require('express');

const router = express.Router();

const { admin, user } = require('./controller');
const { authenticateUser, authorizeRoles } = require('#middlewares');

router.get('/admin', authenticateUser, authorizeRoles('ADMIN'), admin);
router.get('/user', authenticateUser, user);
module.exports = router;
