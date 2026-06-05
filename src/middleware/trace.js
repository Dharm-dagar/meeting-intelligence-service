const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

function traceMiddleware(req, res, next) {
  const traceId = req.headers['x-trace-id'] || uuidv4();
  req.traceId = traceId;
  res.locals.traceId = traceId;
  res.setHeader('x-trace-id', traceId);

  logger.info('Incoming request', {
    traceId,
    method: req.method,
    path: req.path,
  });

  const start = Date.now();
  res.on('finish', () => {
    logger.info('Request completed', {
      traceId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      durationMs: Date.now() - start,
    });
  });

  next();
}

module.exports = traceMiddleware;
