const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const routes = require('./routes');
const { setupSwagger } = require('./config/swagger');
const errorHandler = require('./middlewares/errorHandler');
const notFound = require('./middlewares/notFound');
const config = require('./config');

const app = express();

// ---------------------
// Security Middleware & Rate Limiting
// ---------------------
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 100, // Limit each IP to 100 requests per `window` (here, per 15 minutes)
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: { status: 'fail', message: 'Too many requests from this IP, please try again later.' },
});

app.use(helmet());
app.use(cors());
app.use('/api', limiter); // Apply rate limiter to all /api routes

// ---------------------
// Request Parsing
// ---------------------
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ---------------------
// HTTP Request Logging
// ---------------------
if (!config.isTest) {
  app.use(morgan('dev'));
}

// ---------------------
// API Documentation (Swagger)
// ---------------------
setupSwagger(app);

// ---------------------
// API Routes
// ---------------------
app.use(routes);

// ---------------------
// Error Handling (Error Report Pattern)
// ---------------------
app.use(notFound);
app.use(errorHandler);

module.exports = app;
