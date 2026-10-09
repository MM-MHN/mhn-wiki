import type { NextFunction, Request, Response } from "express";
import multer from "multer";
import { sizeLimitMessage } from "../lib/bytes.js";

export class AppError extends Error {
  status: number;
  details?: Record<string, unknown>;

  constructor(
    status: number,
    message: string,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

function isEntityTooLarge(
  err: unknown
): err is Error & { type: string; limit?: number; length?: number } {
  return (
    typeof err === "object" &&
    err !== null &&
    "type" in err &&
    (err as { type?: string }).type === "entity.too.large"
  );
}

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  if (err instanceof AppError) {
    return res.status(err.status).json({
      error: err.message,
      ...(err.details ?? {}),
    });
  }

  if (isEntityTooLarge(err)) {
    const limit = typeof err.limit === "number" ? err.limit : undefined;
    const length = typeof err.length === "number" ? err.length : undefined;
    const message =
      limit != null
        ? sizeLimitMessage(limit, length)
        : "Request body is too large.";
    return res.status(413).json({
      error: message,
      ...(limit != null ? { limit } : {}),
      ...(length != null ? { size: length } : {}),
    });
  }

  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      const maybeLimit = (err as unknown as { limit?: number }).limit;
      const limit = typeof maybeLimit === "number" ? maybeLimit : undefined;
      const headerSize = Number(req.headers["content-length"]);
      const uploaded = Number.isFinite(headerSize) ? headerSize : undefined;
      const message =
        limit != null
          ? sizeLimitMessage(limit, uploaded)
          : "Uploaded file is too large.";
      return res.status(413).json({
        error: message,
        ...(limit != null ? { limit } : {}),
        ...(uploaded != null ? { size: uploaded } : {}),
      });
    }
    if (err.code === "LIMIT_FILE_COUNT") {
      return res.status(400).json({
        error: "Exceeds maximum allowed file count.",
        code: err.code,
      });
    }
    if (err.code === "LIMIT_UNEXPECTED_FILE") {
      return res.status(400).json({
        error: "Unexpected file field. Use the “file” field for uploads.",
        code: err.code,
      });
    }
    return res.status(400).json({
      error: err.message || "Upload failed",
      code: err.code,
    });
  }

  console.error(err);

  const detail =
    err instanceof Error && err.message.trim() ? err.message.trim() : "";
  const exposeDetail =
    process.env.NODE_ENV !== "production" &&
    detail &&
    detail !== "Internal server error";

  return res.status(500).json({
    error: exposeDetail
      ? detail
      : "Internal server error. Please try again or contact an administrator.",
  });
}

export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
