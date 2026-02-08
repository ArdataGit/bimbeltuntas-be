const express = require('express');
const cors = require('cors');

const cookieParser = require('cookie-parser');
const logger = require('morgan');
const path = require('path');

const app = express();

const routes = require('./src/routes');

const notFoundMiddleware = require('./src/middlewares/not-found');
const handleErrorMiddleware = require('./src/middlewares/handle-error');

require('dotenv').config();

app.use(cors());
app.use(logger('dev'));
app.use(express.urlencoded({ limit: '50mb', extended: false }));
app.use(express.json({ limit: '50mb' }));
app.use(cookieParser());

app.use('/public', express.static(path.join(__dirname, 'public')));

app.use(routes);

app.use((req, res, next) => {
  next();
});

app.use(notFoundMiddleware);
app.use(handleErrorMiddleware);

console.log('[+] Server Running [+]');
console.log(`[+] Port: ${process.env.PORT} [+]`);
module.exports = app;
