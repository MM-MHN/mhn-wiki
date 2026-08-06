export class AppError extends Error {
    status;
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}
export function errorHandler(err, _req, res, _next) {
    if (err instanceof AppError) {
        return res.status(err.status).json({ error: err.message });
    }
    console.error(err);
    return res.status(500).json({ error: "Internal server error" });
}
export function asyncHandler(fn) {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}
