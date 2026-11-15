import type { NextFunction, Request, Response } from 'express';
import { verifyAccessToken } from '../services/auth/authService';

export interface AuthContext {
  uid: string;
  email?: string;
  name?: string;
  emailVerified: boolean;
  isAdmin: boolean;
  isDemo: boolean;
  role?: string;
}

export interface AuthenticatedRequest extends Request {
  authUser?: AuthContext;
}

export const DEMO_AUTH_CONTEXT: AuthContext = {
  uid: 'demo_user',
  email: 'demo@agrishift.local',
  name: 'Demonstration Farmer (UP)',
  emailVerified: true,
  isAdmin: false,
  isDemo: true,
  role: 'farmer'
};

/**
 * Extracts Bearer token from Authorization header or cookie
 */
function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim();
  }
  if (req.cookies && typeof req.cookies.accessToken === 'string') {
    return req.cookies.accessToken;
  }
  return null;
}

/**
 * Optional / Default JWT Auth Middleware:
 * - If Bearer token present: verifies signature, expiration, and issuer.
 * - If Bearer token invalid or expired: rejects immediately with 401 Unauthorized.
 * - If no token present: assigns read-only DEMO_AUTH_CONTEXT.
 */
export function jwtAuthMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const token = extractToken(req);

  if (!token) {
    req.authUser = DEMO_AUTH_CONTEXT;
    return next();
  }

  try {
    const payload = verifyAccessToken(token);
    req.authUser = {
      uid: payload.userId,
      email: payload.email,
      name: payload.fullName,
      emailVerified: payload.emailVerified,
      isAdmin: payload.role === 'admin',
      isDemo: false,
      role: payload.role
    };
    return next();
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Invalid or expired access token.';
    res.status(401).json({
      success: false,
      error: `Authentication failed: ${msg}`
    });
  }
}

/**
 * Guard that enforces that the user is authenticated (not demonstration mode)
 */
export function requireAuthenticatedUser(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (!req.authUser || req.authUser.isDemo) {
    res.status(401).json({
      success: false,
      error: 'Authentication required. Demonstration mode is read-only.'
    });
    return;
  }
  next();
}

/**
 * Guard that requires email verification for sensitive operations
 */
export function requireEmailVerified(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (!req.authUser || req.authUser.isDemo) {
    res.status(401).json({
      success: false,
      error: 'Authentication required. Demonstration mode is read-only.'
    });
    return;
  }
  if (!req.authUser.emailVerified) {
    res.status(403).json({
      success: false,
      error: 'Email verification required. Please verify your email address to continue.'
    });
    return;
  }
  next();
}

/**
 * Guard that requires admin role
 */
export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (!req.authUser || req.authUser.isDemo || !req.authUser.isAdmin) {
    res.status(403).json({
      success: false,
      error: 'Forbidden: administrative privileges required.'
    });
    return;
  }
  next();
}
