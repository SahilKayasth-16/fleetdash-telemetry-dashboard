import { logger } from '../logger/index.js';
import { config } from '../config/index.js';

// Global error handling middleware
export function errorHandler(err, req, res, _next) {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  logger.error(`Error processing request: ${req.method} ${req.originalUrl}`, {
    statusCode,
    message,
    stack: err.stack,
    errors: err.errors,
  });

  res.status(statusCode).json({
    status: 'error',
    statusCode,
    message,
    ...(config.isProduction ? {} : { stack: err.stack, errors: err.errors }),
  });
}

// 404 Route Not Found middleware
export function notFoundHandler(req, res) {
  logger.warn(`Route not found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    status: 'error',
    statusCode: 404,
    message: `Cannot perform ${req.method} on ${req.originalUrl}`,
  });
}
