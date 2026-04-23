import type { Request, Response, NextFunction } from "express";
import AppError from "../utils/appError.js";
import { env } from "../config/env.js";

type MongoishError = AppError & {
  name?: string;
  code?: number;
  keyValue?: Record<string, unknown>;
  errors?: Record<string, { message: string }>;
  path?: string;
  value?: unknown;
  errorResponse?: { code?: number };
};

const handleCastErrorDB = (err: { path?: string; value?: unknown }) => {
  const message = `Invalid ${err.path ?? "field"}: ${String(err.value)}.`;
  return new AppError(message, 400);
};

const handleDuplicateFieldDB = (err: { keyValue?: Record<string, unknown> }) => {
  const keyValue = err.keyValue ?? {};
  const keys = Object.keys(keyValue);
  if (keys.length === 0) {
    return new AppError("Duplicate field value. Please use another value!", 400);
  }
  const key = keys[0];
  if (!key) {
    return new AppError("Duplicate field value. Please use another value!", 400);
  }
  const value = keyValue[key];
  return new AppError(
    `Duplicate field value: ${key}: ${String(value)}. Please use another value!`,
    400,
  );
};

const handleValidationErrorDB = (err: {
  errors?: Record<string, { message: string }>;
}) => {
  const errors = Object.values(err.errors ?? {}).map((el) => el.message);
  const message = `Invalid input data. ${errors.join(". ")}`;
  return new AppError(message, 400);
};

const handleJsonWebTokenError = () =>
  new AppError("Invalid token! Please log in again.", 401);

const handleJwtTokenExpiredError = () =>
  new AppError("Your token has expired. Please log in again.", 401);

const sendErrorDev = (err: AppError & { stack?: string }, res: Response) => {
  res.status(err.statusCode).json({
    status: err.status,
    error: err,
    message: err.message,
    stack: err.stack,
  });
};

const sendErrorProd = (err: AppError, res: Response) => {
  if (err.isOperational) {
    res.status(err.statusCode).json({
      status: err.status,
      message: err.message,
    });
  } else {
    res.status(500).json({
      status: "error",
      message: "Something went wrong!",
    });
  }
};

function normalizeToAppError(err: unknown): AppError {
  if (err instanceof AppError) {
    return err;
  }
  const e = err as MongoishError;
  if (e.name === "CastError") return handleCastErrorDB(e);
  if (e.code === 11000 || e.errorResponse?.code === 11000) {
    return handleDuplicateFieldDB(e);
  }
  if (e.name === "ValidationError") return handleValidationErrorDB(e);
  if (e.name === "JsonWebTokenError") return handleJsonWebTokenError();
  if (e.name === "TokenExpiredError") return handleJwtTokenExpiredError();

  const msg =
    err instanceof Error ? err.message : String(err ?? "Something went wrong!");
  return new AppError(msg, 500);
}

export default (
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) => {
  const isDev = env.nodeEnv === "development";
  const error = normalizeToAppError(err);

  if (isDev) {
    sendErrorDev(
      {
        ...error,
        stack: err instanceof Error ? err.stack : error.stack,
      } as AppError & { stack?: string },
      res,
    );
    return;
  }

  sendErrorProd(error, res);
};
