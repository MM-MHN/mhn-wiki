import type { NextFunction, Request, Response } from "express";
export declare class AppError extends Error {
    status: number;
    constructor(status: number, message: string);
}
export declare function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): Response<any, Record<string, any>>;
export declare function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): (req: Request, res: Response, next: NextFunction) => void;
