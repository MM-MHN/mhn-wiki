import "dotenv/config";
import cors from "cors";
import express from "express";
import morgan from "morgan";
import path from "node:path";
import { authRouter } from "./routes/auth.js";
import { spacesRouter } from "./routes/spaces.js";
import { pagesRouter } from "./routes/pages.js";
import { adminRouter } from "./routes/admin.js";
import { settingsRouter } from "./routes/settings.js";
import { uploadsDir, uploadsRouter } from "./routes/uploads.js";
import { errorHandler } from "./middleware/error.js";

const app = express();
const port = Number(process.env.PORT || 4000);

app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true,
  })
);
app.use(express.json({ limit: "5mb" }));
app.use(morgan("dev"));
app.use("/uploads", express.static(uploadsDir));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "wiki-manual-api" });
});

app.use("/api/auth", authRouter);
app.use("/api/spaces", spacesRouter);
app.use("/api/pages", pagesRouter);
app.use("/api/admin", adminRouter);
app.use("/api/settings", settingsRouter);
app.use("/api/uploads", uploadsRouter);

app.use(errorHandler);

app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
  console.log(`Uploads directory: ${path.resolve(uploadsDir)}`);
});
