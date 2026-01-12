import { Request, Response, NextFunction } from 'express';
import { Logger } from '../utils/logger';

export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;

  constructor(message: string, statusCode: number = 500, isOperational: boolean = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

export const errorHandler = (logger?: Logger) => {
  return (err: Error | AppError, req: Request, res: Response, next: NextFunction): void => {
    if (logger) {
      logger.error('Error occurred:', {
        error: err.message,
        stack: err.stack,
        path: req.path,
        method: req.method,
      });
    } else {
      console.error('Error:', err);
    }

    if (err instanceof AppError) {
      res.status(err.statusCode).json({
        error: err.message,
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
      });
      return;
    }

    // Default error
    res.status(500).json({
      error: 'Internal server error',
      ...(process.env.NODE_ENV === 'development' && { message: err.message, stack: err.stack }),
    });
  };
};

export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
