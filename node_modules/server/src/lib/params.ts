import type { Request } from "express";
import { AppError } from "../middleware/error.js";

export function param(req: Request, name: string): string {
  const value = req.params[name];
  if (typeof value !== "string") {
    throw new AppError(400, `Invalid route parameter: ${name}`);
  }
  return value;
}
