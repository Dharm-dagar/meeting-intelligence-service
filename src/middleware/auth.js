const jwt = require('jsonwebtoken');
const { errorResponse } = require('../utils/response');

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return errorResponse(res, 401, 'UNAUTHORIZED', 'Authorization header missing or invalid');
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
    req.user = decoded;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return errorResponse(res, 401, 'TOKEN_EXPIRED', 'Token has expired');
    }
    return errorResponse(res, 401, 'INVALID_TOKEN', 'Invalid token');
  }
}

module.exports = authMiddleware;
