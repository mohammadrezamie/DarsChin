import type { ErrorRequestHandler } from 'express';
import { logger } from '../utils/logger';

/** Never log raw exception messages, stacks, URLs, student data or credentials. */
export const apiErrorHandler: ErrorRequestHandler = (error: unknown, req, res, next) => {
  if (res.headersSent) return next(error);
  const isBadJson = Boolean(
    error && typeof error === 'object' &&
    'status' in error && error.status === 400 &&
    'type' in error && error.type === 'entity.parse.failed'
  );
  if (!isBadJson) {
    logger.error('API request failed', { code: 'UNHANDLED_API_ERROR', method: req.method });
  }
  return res.status(isBadJson ? 400 : 500).json({
    success: false,
    error: isBadJson ? 'ساختار JSON درخواست نامعتبر است.' : 'خطای داخلی سرور',
  });
};
