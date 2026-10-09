import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import multer from "multer";
import { Role } from "@prisma/client";
import { sizeLimitMessage } from "../lib/bytes.js";
import { AppError, asyncHandler } from "../middleware/error.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const uploadsDir = path.resolve(__dirname, "../../uploads");

/** Keep in sync with client MAX_UPLOAD_BYTES. */
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || ".png";
    const safeExt = [".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"].includes(
      ext
    )
      ? ext
      : ".png";
    const name = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${safeExt}`;
    cb(null, name);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      cb(new Error("Only image uploads are allowed"));
      return;
    }
    cb(null, true);
  },
});

export const uploadsRouter = Router();

uploadsRouter.post(
  "/",
  requireAuth,
  requireRole(Role.ADMIN, Role.EDITOR),
  (req, res, next) => {
    upload.single("file")(req, res, (err) => {
      if (!err) return next();

      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          const headerSize = Number(req.headers["content-length"]);
          const uploaded = Number.isFinite(headerSize)
            ? headerSize
            : undefined;
          return next(
            new AppError(
              413,
              sizeLimitMessage(MAX_UPLOAD_BYTES, uploaded),
              {
                limit: MAX_UPLOAD_BYTES,
                ...(uploaded != null ? { size: uploaded } : {}),
              }
            )
          );
        }
        if (err.code === "LIMIT_FILE_COUNT") {
          return next(
            new AppError(400, "Exceeds maximum allowed file count of 1.", {
              maxCount: 1,
            })
          );
        }
        return next(new AppError(400, err.message || "Upload failed"));
      }

      return next(
        new AppError(
          400,
          err instanceof Error ? err.message : "Upload failed"
        )
      );
    });
  },
  asyncHandler(async (req, res) => {
    if (!req.file) throw new AppError(400, "No image file provided");
    const url = `/uploads/${req.file.filename}`;
    res.status(201).json({
      url,
      filename: req.file.filename,
      size: req.file.size,
      mimeType: req.file.mimetype,
    });
  })
);
