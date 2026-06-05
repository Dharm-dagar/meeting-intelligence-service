function successResponse(res, data, statusCode = 200, traceId) {
  return res.status(statusCode).json({
    traceId: traceId || res.locals.traceId,
    success: true,
    data,
  });
}

function errorResponse(res, statusCode, code, message, traceId) {
  return res.status(statusCode).json({
    traceId: traceId || res.locals.traceId,
    success: false,
    error: { code, message },
  });
}

module.exports = { successResponse, errorResponse };
