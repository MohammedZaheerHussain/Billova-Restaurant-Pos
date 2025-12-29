// Authentication Middleware
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthRequest extends Request {
    user?: {
        id: string;
        email: string;
        role: string;
        branchId: string;
    };
}

export const authMiddleware = async (req: AuthRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret') as any;

        // Fetch fresh user data from database to get current role
        const prisma = (req as any).prisma;
        if (prisma) {
            const freshUser = await prisma.user.findUnique({
                where: { id: decoded.id },
                select: { id: true, email: true, role: true, branchId: true, isActive: true }
            });

            if (!freshUser || !freshUser.isActive) {
                return res.status(401).json({ error: 'User not found or inactive' });
            }

            // Use fresh role from database instead of JWT token
            req.user = {
                id: freshUser.id,
                email: freshUser.email,
                role: freshUser.role,
                branchId: freshUser.branchId,
            };
        } else {
            // Fallback to token data if prisma not available
            req.user = decoded;
        }

        next();
    } catch (error) {
        return res.status(401).json({ error: 'Invalid token' });
    }
};

// Role-based authorization
export const requireRole = (...roles: string[]) => {
    return (req: AuthRequest, res: Response, next: NextFunction) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }

        next();
    };
};
