import type { NextFunction, Request, Response } from "express";
import type { Role } from "@prisma/client";
export type AuthUser = {
    id: string;
    username: string;
    email: string | null;
    name: string;
    role: Role;
};
declare global {
    namespace Express {
        interface Request {
            user?: AuthUser;
        }
    }
}
export declare function toAuthUser(user: {
    id: string;
    username: string;
    email: string | null;
    name: string;
    role: Role;
}): AuthUser;
export declare function signToken(user: AuthUser): string;
export declare function optionalAuth(req: Request, _res: Response, next: NextFunction): Promise<void>;
export declare function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void>;
export declare function requireRole(...roles: Role[]): (req: Request, _res: Response, next: NextFunction) => void;
