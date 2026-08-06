import { AppError } from "../middleware/error.js";
export function param(req, name) {
    const value = req.params[name];
    if (typeof value !== "string") {
        throw new AppError(400, `Invalid route parameter: ${name}`);
    }
    return value;
}
