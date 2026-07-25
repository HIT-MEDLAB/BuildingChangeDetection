// Centralized error-handling middleware.
// Express recognizes this as an error handler because it has 4 parameters.
// Any error thrown or passed via next(err) in route handlers ends up here.

const logger = require('../config/logger');

function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || 500;

  logger.error('Unhandled error', {
    message: err.message,
    stack: err.stack,
    method: req.method,
    path: req.originalUrl,
    userId: req.user?.userId,
    statusCode
  });

  // TODO: In production, don't leak stack traces to the client
  res.status(statusCode).json({
    error: err.message || 'Internal server error',
  });
}

module.exports = errorHandler;
