function errorHandler(err, req, res, _next) {
  console.error('[Error]', err.message);
  console.error(err.stack);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || '服务器内部错误',
  });
}

module.exports = errorHandler;
