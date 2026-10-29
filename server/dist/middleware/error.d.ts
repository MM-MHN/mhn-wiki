import type { NextFunction, Request, Response } from "express";
export declare class AppError extends Error {
    status: number;
    details?: Record<string, unknown>;
    constructor(status: number, message: string, details?: Record<string, unknown>);
}
export declare function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): Response<any, Record<string, any>>;
export declare function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): (req: Request, res: Response, next: NextFunction) => void;
