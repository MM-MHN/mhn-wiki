import multer from "multer";
import { sizeLimitMessage } from "../lib/bytes.js";
export class AppError extends Error {
    status;
    details;
    constructor(status, message, details) {
        super(message);
        this.status = status;
        this.details = details;
    }
}
function isEntityTooLarge(err) {
    return (typeof err === "object" &&
        err !== null &&
        "type" in err &&
        err.type === "entity.too.large");
}
export function errorHandler(err, req, res, _next) {
    if (err instanceof AppError) {
        return res.status(err.status).json({
            error: err.message,
            ...(err.details ?? {}),
        });
    }
    if (isEntityTooLarge(err)) {
        const limit = typeof err.limit === "number" ? err.limit : undefined;
        const length = typeof err.length === "number" ? err.length : undefined;
        const message = limit != null
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
            const maybeLimit = err.limit;
            const limit = typeof maybeLimit === "number" ? maybeLimit : undefined;
            const headerSize = Number(req.headers["content-length"]);
            const uploaded = Number.isFinite(headerSize) ? headerSize : undefined;
            const message = limit != null
                ? sizeLimitMessage(limit, uploaded)
                : "Uploaded file is too large.";
            return res.status(413).json({
                error: message,
                ...(limit != null ? { limit } : {}),
                ...(uploaded != null ? { size: uploaded } : {}),
            });
        }
        return res.status(400).json({
            error: err.message || "Upload failed",
            code: err.code,
        });
    }
    console.error(err);
    const detail = err instanceof Error && err.message.trim() ? err.message.trim() : "";
    const exposeDetail = process.env.NODE_ENV !== "production" &&
        detail &&
        detail !== "Internal server error";
    return res.status(500).json({
        error: exposeDetail
            ? detail
            : "Internal server error. Please try again or contact an administrator.",
    });
}
export function asyncHandler(fn) {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}
