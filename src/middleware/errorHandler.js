const logger = require('../utils/logger');

function errorHandler(err, req, res, next) {
  const traceId = res.locals.traceId || req.traceId;

  logger.error('Unhandled error', {
    traceId,
    method: req.method,
    path: req.path,
    error: err.message,
    stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined,
  });

  // Zod validation errors
  if (err.name === 'ZodError') {
    const messages = err.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ');
    return res.status(400).json({
      traceId,
      success: false,
      error: { code: 'VALIDATION_ERROR', message: messages },
    });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    return res.status(401).json({
      traceId,
      success: false,
      error: { code: 'UNAUTHORIZED', message: err.message },
    });
  }

  // Known operational errors
  if (err.statusCode) {
    return res.status(err.statusCode).json({
      traceId,
      success: false,
      error: { code: err.code || 'ERROR', message: err.message },
    });
  }

  // Unknown errors
  return res.status(500).json({
    traceId,
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
    },
  });
}

module.exports = errorHandler;
