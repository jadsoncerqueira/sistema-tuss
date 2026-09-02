/**
 * Middleware para capturar rotas não encontradas (404)
 */
function notFoundHandler(req, res) {
  res.status(404).json({
    error: `Rota não encontrada: ${req.method} ${req.url}`,
    timestamp: new Date().toISOString()
  });
}

/**
 * Middleware Global de Tratamento de Erros (500)
 */
function globalErrorHandler(err, req, res, next) {
  console.error('❌ [ErrorHandler] Erro capturado:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Erro interno do servidor',
    timestamp: new Date().toISOString()
  });
}

module.exports = {
  notFoundHandler,
  globalErrorHandler,
};
