// Centralized error-handling middleware.
// Express recognizes this as an error handler because it has 4 parameters.
// Any error thrown or passed via next(err) in route handlers ends up here.

function errorHandler(err, req, res, next) {
  console.error('Unhandled error:', err.message);

  // TODO: In production, don't leak stack traces to the client
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    error: err.message || 'Internal server error',
  });
}

module.exports = errorHandler;
