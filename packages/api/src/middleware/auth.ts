// Authentication Middleware
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';

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
    const authProvider = req.headers['x-auth-provider'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];

    try {
        const sb = (req as any).supabase || supabase;
        let userId: string;

        // Check if it's a Supabase token (signaled by header or try Supabase first)
        if (authProvider === 'supabase') {
            // Validate Supabase token
            const { data: { user: supabaseUser }, error: supabaseError } = await sb.auth.getUser(token);

            if (supabaseError || !supabaseUser) {
                logger.debug('[Auth] Supabase token invalid:', supabaseError?.message);
                return res.status(401).json({ error: 'Invalid token' });
            }

            userId = supabaseUser.id;
        } else {
            // Try Supabase first, fallback to JWT
            const { data: { user: supabaseUser }, error: supabaseError } = await sb.auth.getUser(token);

            if (!supabaseError && supabaseUser) {
                userId = supabaseUser.id;
            } else {
                // Fallback to legacy JWT verification
                try {
                    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret') as any;
                    userId = decoded.id;
                } catch (jwtError) {
                    logger.debug('[Auth] Both Supabase and JWT validation failed');
                    return res.status(401).json({ error: 'Invalid token' });
                }
            }
        }

        // Fetch fresh user data from Supabase profiles table
        const { data: freshUser, error } = await sb
            .from('profiles')
            .select('id, email, role, branch_id, is_active')
            .eq('id', userId)
            .single();

        if (error || !freshUser) {
            logger.debug('[Auth] User not found in profiles:', userId, error?.message);
            return res.status(401).json({ error: 'User not found or inactive' });
        }

        // Skip is_active check for super admins (they may not have branch)
        if (!freshUser.is_active && freshUser.role !== 'SUPER_ADMIN' && freshUser.role !== 'super_admin') {
            return res.status(401).json({ error: 'User not found or inactive' });
        }

        // Use fresh role from database
        req.user = {
            id: freshUser.id,
            email: freshUser.email,
            role: freshUser.role,
            branchId: freshUser.branch_id,
        };

        next();
    } catch (error) {
        logger.error('[Auth] Middleware error:', error);
        return res.status(401).json({ error: 'Invalid token' });
    }
};

// Role-based authorization
export const requireRole = (...roles: string[]) => {
    return (req: AuthRequest, res: Response, next: NextFunction) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        // Normalize roles for comparison (handle case sensitivity)
        const normalizedUserRole = req.user.role.toLowerCase();
        const normalizedRoles = roles.map(r => r.toLowerCase());

        if (!normalizedRoles.includes(normalizedUserRole)) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }

        next();
    };
};
