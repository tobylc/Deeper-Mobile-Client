import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";

export interface AppError extends Error {
  statusCode: number;
  isOperational: boolean;
}

export class CustomError extends Error implements AppError {
  statusCode: number;
  isOperational: boolean;

  constructor(message: string, statusCode: number = 500, isOperational: boolean = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends CustomError {
  constructor(message: string) {
    super(message, 400);
  }
}

export class NotFoundError extends CustomError {
  constructor(resource: string) {
    super(`${resource} not found`, 404);
  }
}

export class UnauthorizedError extends CustomError {
  constructor(message: string = "Unauthorized") {
    super(message, 401);
  }
}

export class ForbiddenError extends CustomError {
  constructor(message: string = "Forbidden") {
    super(message, 403);
  }
}

export class ConflictError extends CustomError {
  constructor(message: string) {
    super(message, 409);
  }
}

export class TooManyRequestsError extends CustomError {
  constructor(message: string = "Too many requests") {
    super(message, 429);
  }
}

export function createError(message: string, statusCode: number = 500): AppError {
  return new CustomError(message, statusCode);
}

export function asyncHandler(fn: Function) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export function globalErrorHandler(
  error: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Default error values
  let statusCode = 500;
  let message = "Internal server error";
  let details: any = undefined;

  // Handle known error types
  if ('statusCode' in error && 'isOperational' in error) {
    // Custom app error
    statusCode = error.statusCode;
    message = error.message;
  } else if (error instanceof ZodError) {
    // Zod validation error
    statusCode = 400;
    message = "Validation error";
    details = error.errors.map(err => ({
      field: err.path.join('.'),
      message: err.message
    }));
  } else if (error.message.includes('unique constraint') || error.message.includes('duplicate key')) {
    // Database duplicate key error
    statusCode = 409;
    message = "Resource already exists";
  } else if (error.message.includes('foreign key constraint')) {
    // Database foreign key error
    statusCode = 400;
    message = "Invalid reference to related resource";
  } else if (error.message.includes('connection') || error.message.includes('ECONNREFUSED')) {
    // Database connection error
    statusCode = 503;
    message = "Service temporarily unavailable";
  }

  // Log error for debugging
  console.error(`Error ${statusCode}:`, {
    message: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  // Send error response
  const errorResponse: any = {
    success: false,
    message,
    statusCode
  };

  if (details) {
    errorResponse.details = details;
  }

  // Include stack trace in development
  if (process.env.NODE_ENV === 'development') {
    errorResponse.stack = error.stack;
  }

  res.status(statusCode).json(errorResponse);
}

export function notFoundHandler(req: Request, res: Response, next: NextFunction) {
  const error = new NotFoundError(`Route ${req.originalUrl} not found`);
  next(error);
}

// Database error handling utilities
export function handleDatabaseError(error: any): AppError {
  if (error.code === '23505') {
    // Unique constraint violation
    return new ConflictError("Resource already exists");
  }
  
  if (error.code === '23503') {
    // Foreign key constraint violation
    return new ValidationError("Invalid reference to related resource");
  }
  
  if (error.code === '23514') {
    // Check constraint violation
    return new ValidationError("Data validation failed");
  }
  
  if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
    // Connection errors
    return new CustomError("Service temporarily unavailable", 503);
  }
  
  // Default database error
  return new CustomError("Database operation failed", 500);
}

// Graceful shutdown handling
export function setupGracefulShutdown(server: any) {
  const shutdown = (signal: string) => {
    console.log(`Received ${signal}. Starting graceful shutdown...`);
    
    server.close(() => {
      console.log("HTTP server closed.");
      process.exit(0);
    });
    
    // Force close after 10 seconds
    setTimeout(() => {
      console.error("Could not close connections in time, forcefully shutting down");
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}