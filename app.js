const createError = require('http-errors');
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const cors = require('cors');
// const requestIp = require('request-ip');
require('dotenv').config();

const indexRouter = require('./routes/index');

const app = express();

require('./connection');
// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

var whitelist = [
  'http://localhost:3000',
  'http://localhost:3001',
  'https://maryjanethehome.me/',
  'www.maryjanethehome.me',
  'maryjanethehome.me',
  'https://maryjanethehome.me',
  'https://www.maryjanethehome.me',
  'http://maryjanethehome.me',
  'http://www.maryjanethehome.me',
  'http://maryjanethehome.me/',
  'http://www.maryjanethehome.me/',
  'https://admin-booking-beta.vercel.app/',
  'https://admin-booking-beta.vercel.app',
  'admin-booking-beta.vercel.app'
];
var corsOptions = {
  origin: function (origin, callback) {
    if (whitelist.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }
};

// app.use(cors(corsOptions));
app.use(cors());
app.use(function (req, res, next) {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.header(
    'Access-Control-Allow-Headers',
    'Origin, X-Requested-With, Content-Type, Accept'
  );
  next();
});
// app.use(requestIp.mw())
// app.use(logger('tiny'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
