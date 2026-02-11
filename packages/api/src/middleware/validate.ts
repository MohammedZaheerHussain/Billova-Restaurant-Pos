// Zod Validation Middleware
import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

/**
 * Express middleware that validates request body against a Zod schema.
 * Returns 400 with structured error details if validation fails.
 */
export function validate(schema: ZodSchema) {
    return (req: Request, res: Response, next: NextFunction) => {
        try {
            req.body = schema.parse(req.body);
            next();
        } catch (error) {
            if (error instanceof ZodError) {
                const errors = error.issues.map((e: any) => ({
                    field: e.path.join('.'),
                    message: e.message,
                }));
                return res.status(400).json({
                    error: 'Validation failed',
                    details: errors,
                });
            }
            next(error);
        }
    };
}

/**
 * Express middleware that validates request query params against a Zod schema.
 */
export function validateQuery(schema: ZodSchema) {
    return (req: Request, res: Response, next: NextFunction) => {
        try {
            const parsed = schema.parse(req.query);
            (req as any).validatedQuery = parsed;
            next();
        } catch (error) {
            if (error instanceof ZodError) {
                const errors = error.issues.map((e: any) => ({
                    field: e.path.join('.'),
                    message: e.message,
                }));
                return res.status(400).json({
                    error: 'Invalid query parameters',
                    details: errors,
                });
            }
            next(error);
        }
    };
}

/**
 * Express middleware that validates request params against a Zod schema.
 */
export function validateParams(schema: ZodSchema) {
    return (req: Request, res: Response, next: NextFunction) => {
        try {
            const parsed = schema.parse(req.params);
            (req as any).validatedParams = parsed;
            next();
        } catch (error) {
            if (error instanceof ZodError) {
                const errors = error.issues.map((e: any) => ({
                    field: e.path.join('.'),
                    message: e.message,
                }));
                return res.status(400).json({
                    error: 'Invalid parameters',
                    details: errors,
                });
            }
            next(error);
        }
    };
}
