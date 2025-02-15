const express = require('express'); // web framework

const morgan = require('morgan'); // logging middleware

const rateLimit = require('express-rate-limit'); // rate limiting middleware

const helmet = require('helmet'); // security middleware

const mongoSanitize = require('express-mongo-sanitize'); // security middleware

const bodyParser = require('body-parser'); // request parsing middleware

const xss = require('xss'); // security middleware

const cors = require('cors'); // security middleware

const app = express();

app.use(express.urlencoded({ extended: true })); // request body parsing middleware

app.use(mongoSanitize()); // data sanitization against NoSQL query injection middleware

//app.use(xss()); // data sanitization against XSS middleware

app.use(
  cors({
    origin: '*',
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE'],
    credentials: true, // enable set cookie
  })
); // enable CORS middleware

app.use(express.json({ limit: '10kb' })); // request body parsing middleware
app.use(bodyParser.json()); // request body parsing middleware
app.use(bodyParser.urlencoded({ extended: true })); // request body parsing middleware
app.use(helmet()); // set security HTTP headers middleware

if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev')); // http request logging middleware
}

const limiter = rateLimit({
  max: 3000,
  windowMs: 60 * 60 * 1000,
  message: 'Too many requests from this IP, please try again after an hour',
});

app.use('/talk', limiter); // rate limiting middleware

module.exports = app; // export app
