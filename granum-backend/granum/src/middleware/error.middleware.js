/**
 * Central error handler — must be registered last in Express.
 */
function errorHandler(err, req, res, next) {  // eslint-disable-line no-unused-vars
  const status  = err.status || err.statusCode || 500;
  const message = err.message || 'Internal server error';

  // don't leak stack traces in production
  if (process.env.NODE_ENV === 'development') {
    console.error(`[${status}] ${req.method} ${req.path} —`, err.stack || err.message);
  } else if (status >= 500) {
    console.error(`[${status}] ${req.method} ${req.path} —`, message);
  }

  res.status(status).json({
    error:   message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
}

/**
 * 404 catch-all — register before errorHandler.
 */
function notFound(req, res) {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` });
}

module.exports = { errorHandler, notFound };
