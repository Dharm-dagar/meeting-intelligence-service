const { registerSchema, loginSchema } = require('../utils/validation');
const authService = require('../services/authService');
const { successResponse, errorResponse } = require('../utils/response');
const logger = require('../utils/logger');

async function register(req, res, next) {
  try {
    const data = registerSchema.parse(req.body);
    const result = await authService.register(data);
    logger.info('User registered', { traceId: req.traceId, email: data.email });
    return successResponse(res, result, 201);
  } catch (err) {
    next(err);
  }
}

async function login(req, res, next) {
  try {
    const data = loginSchema.parse(req.body);
    const result = await authService.login(data);
    logger.info('User logged in', { traceId: req.traceId, email: data.email });
    return successResponse(res, result);
  } catch (err) {
    next(err);
  }
}

module.exports = { register, login };
