import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { prisma } from '../config/database';
import {
  authenticateOrLinkGoogleUser,
  createPasswordResetToken,
  createRefreshToken,
  generateAccessToken,
  hashPassword,
  recordAuditLog,
  resetPasswordWithToken,
  revokeAllUserRefreshTokens,
  revokeRefreshToken,
  rotateRefreshToken,
  verifyGoogleToken,
  verifyPassword
} from '../services/auth/authService';
import {
  requireAuthenticatedUser,
  type AuthenticatedRequest
} from '../middleware/authMiddleware';
import type { UserProfile, UserRole } from '../../shared/types/agri';

export const authRouter = Router();

const isProd = process.env.NODE_ENV === 'production';

// Strict Rate Limiting for Auth Endpoints
const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many authentication attempts. Please wait 15 minutes before trying again.'
  }
});

const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many password reset requests. Please wait an hour before trying again.'
  }
});

// Zod Validation Schemas
const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).{8,100}$/;

const registerSchema = z
  .object({
    fullName: z.string().trim().min(2, 'Full name must be at least 2 characters').max(100),
    email: z.string().trim().email('Invalid email address').max(200),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .max(100)
      .regex(
        strongPasswordRegex,
        'Password must contain at least 1 uppercase letter, 1 lowercase letter, 1 number, and 1 special character.'
      ),
    confirmPassword: z.string()
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword']
  });

const loginSchema = z.object({
  email: z.string().trim().email('Invalid email address').max(200),
  password: z.string().min(1, 'Password is required').max(100),
  rememberMe: z.boolean().optional()
});

const forgotPasswordSchema = z.object({
  email: z.string().trim().email('Invalid email address').max(200)
});

const resetPasswordSchema = z
  .object({
    token: z.string().min(10, 'Reset token is required'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .max(100)
      .regex(
        strongPasswordRegex,
        'Password must contain at least 1 uppercase letter, 1 lowercase letter, 1 number, and 1 special character.'
      ),
    confirmPassword: z.string()
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword']
  });

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z
      .string()
      .min(8, 'New password must be at least 8 characters')
      .max(100)
      .regex(
        strongPasswordRegex,
        'New password must contain at least 1 uppercase letter, 1 lowercase letter, 1 number, and 1 special character.'
      ),
    confirmPassword: z.string()
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'New passwords do not match',
    path: ['confirmPassword']
  });

function setRefreshTokenCookie(res: any, rawToken: string, maxAgeDays = 7) {
  res.cookie('refreshToken', rawToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'strict' : 'lax',
    path: '/api/auth',
    maxAge: maxAgeDays * 24 * 60 * 60 * 1000
  });
}

function clearRefreshTokenCookie(res: any) {
  res.clearCookie('refreshToken', {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'strict' : 'lax',
    path: '/api/auth'
  });
}

function toUserProfile(user: {
  id: string;
  fullName: string;
  email: string;
  role: string;
  preferredLanguage?: string;
  location?: string;
  createdAt: Date;
  updatedAt: Date;
}): UserProfile {
  return {
    uid: user.id,
    name: user.fullName,
    email: user.email,
    role: (user.role as UserRole) || 'farmer',
    preferredLanguage: user.preferredLanguage || 'English',
    location: user.location || 'India',
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString()
  };
}

/**
 * POST /api/auth/register
 */
authRouter.post('/register', authRateLimiter, async (req, res) => {
  try {
    const parseResult = registerSchema.safeParse(req.body);
    if (!parseResult.success) {
      const errorMsg = parseResult.error.issues.map((e: { message: string }) => e.message).join('. ');
      res.status(400).json({ success: false, error: errorMsg });
      return;
    }

    const { fullName, email, password } = parseResult.data;
    const normalizedEmail = email.toLowerCase();

    // Check email uniqueness
    const existing = await prisma.user.findUnique({
      where: { email: normalizedEmail }
    });

    if (existing) {
      res.status(409).json({
        success: false,
        error: 'An account with this email address already exists. Please sign in.'
      });
      return;
    }

    const passwordHash = await hashPassword(password);

    const user = await prisma.user.create({
      data: {
        fullName,
        email: normalizedEmail,
        passwordHash,
        emailVerified: true, // Primary email/password accounts verified on registration
        accountStatus: 'active',
        role: 'farmer',
        preferredLanguage: 'English',
        location: 'India'
      }
    });

    // Generate tokens
    const accessToken = generateAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      fullName: user.fullName,
      emailVerified: user.emailVerified
    });

    const { rawToken } = await createRefreshToken(user.id);
    setRefreshTokenCookie(res, rawToken);

    await recordAuditLog({
      userId: user.id,
      action: 'USER_REGISTERED',
      resourceType: 'user',
      resourceId: user.id,
      metadata: { email: user.email }
    });

    res.status(201).json({
      success: true,
      data: {
        user: toUserProfile(user),
        accessToken
      }
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Registration failed';
    res.status(500).json({ success: false, error: msg });
  }
});

/**
 * POST /api/auth/login
 */
authRouter.post('/login', authRateLimiter, async (req, res) => {
  try {
    const parseResult = loginSchema.safeParse(req.body);
    if (!parseResult.success) {
      const errorMsg = parseResult.error.issues.map((e: { message: string }) => e.message).join('. ');
      res.status(400).json({ success: false, error: errorMsg });
      return;
    }

    const { email, password, rememberMe } = parseResult.data;
    const normalizedEmail = email.toLowerCase();

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail }
    });

    if (!user || !user.passwordHash) {
      // If user exists with only Google OAuth (no password hash)
      if (user && !user.passwordHash) {
        res.status(401).json({
          success: false,
          error: 'This account was created using Google Sign-In. Please sign in with Google or reset your password.'
        });
        return;
      }
      res.status(401).json({
        success: false,
        error: 'Invalid email or password.'
      });
      return;
    }

    const isMatch = await verifyPassword(password, user.passwordHash);
    if (!isMatch) {
      await recordAuditLog({
        userId: user.id,
        action: 'LOGIN_FAILED_BAD_PASSWORD',
        resourceType: 'user',
        resourceId: user.id,
        metadata: { email: normalizedEmail }
      });
      res.status(401).json({
        success: false,
        error: 'Invalid email or password.'
      });
      return;
    }

    if (user.accountStatus !== 'active') {
      res.status(403).json({
        success: false,
        error: `Account is ${user.accountStatus}. Please contact support.`
      });
      return;
    }

    const accessToken = generateAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      fullName: user.fullName,
      emailVerified: user.emailVerified
    });

    const maxAgeDays = rememberMe ? 30 : 7;
    const { rawToken } = await createRefreshToken(user.id);
    setRefreshTokenCookie(res, rawToken, maxAgeDays);

    await recordAuditLog({
      userId: user.id,
      action: 'LOGIN_SUCCESS',
      resourceType: 'user',
      resourceId: user.id
    });

    res.status(200).json({
      success: true,
      data: {
        user: toUserProfile(user),
        accessToken
      }
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Login failed';
    res.status(500).json({ success: false, error: msg });
  }
});

/**
 * POST /api/auth/refresh
 */
authRouter.post('/refresh', async (req, res) => {
  try {
    const token = req.cookies?.refreshToken || req.body?.refreshToken;
    if (!token || typeof token !== 'string') {
      res.status(401).json({
        success: false,
        error: 'Refresh token is required.'
      });
      return;
    }

    const result = await rotateRefreshToken(token);
    setRefreshTokenCookie(res, result.newRefreshToken);

    const fullUser = await prisma.user.findUnique({
      where: { id: result.user.id }
    });

    res.status(200).json({
      success: true,
      data: {
        user: fullUser ? toUserProfile(fullUser) : result.user,
        accessToken: result.accessToken
      }
    });
  } catch (err) {
    clearRefreshTokenCookie(res);
    const msg = err instanceof Error ? err.message : 'Token refresh failed';
    res.status(401).json({ success: false, error: msg });
  }
});

/**
 * POST /api/auth/logout
 */
authRouter.post('/logout', async (req: AuthenticatedRequest, res) => {
  try {
    const token = req.cookies?.refreshToken || req.body?.refreshToken;
    if (token && typeof token === 'string') {
      await revokeRefreshToken(token);
    }
    clearRefreshTokenCookie(res);

    if (req.authUser && !req.authUser.isDemo) {
      await recordAuditLog({
        userId: req.authUser.uid,
        action: 'LOGOUT',
        resourceType: 'user',
        resourceId: req.authUser.uid
      });
    }

    res.status(200).json({ success: true, message: 'Logged out successfully.' });
  } catch (err) {
    clearRefreshTokenCookie(res);
    res.status(200).json({ success: true, message: 'Logged out.' });
  }
});

/**
 * POST /api/auth/logout-all
 */
authRouter.post('/logout-all', requireAuthenticatedUser, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.authUser!.uid;
    const revokedCount = await revokeAllUserRefreshTokens(userId);
    clearRefreshTokenCookie(res);

    await recordAuditLog({
      userId,
      action: 'LOGOUT_ALL_DEVICES',
      resourceType: 'user',
      resourceId: userId,
      metadata: { revokedCount }
    });

    res.status(200).json({
      success: true,
      message: `Successfully logged out from all devices (${revokedCount} session(s) revoked).`
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to revoke sessions';
    res.status(500).json({ success: false, error: msg });
  }
});

/**
 * GET /api/auth/me
 */
authRouter.get('/me', async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.authUser || req.authUser.isDemo) {
      res.status(200).json({
        success: true,
        data: {
          uid: 'demo_user',
          name: 'Demonstration Farmer (UP)',
          email: 'demo@agrishift.local',
          role: 'farmer',
          preferredLanguage: 'English',
          location: 'Barabanki, Uttar Pradesh, India',
          createdAt: '2026-01-10T08:00:00.000Z',
          updatedAt: '2026-10-15T08:00:00.000Z',
          isDemo: true
        }
      });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: req.authUser.uid }
    });

    if (!user) {
      res.status(404).json({ success: false, error: 'User not found.' });
      return;
    }

    res.status(200).json({
      success: true,
      data: {
        ...toUserProfile(user),
        isDemo: false
      }
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch user';
    res.status(500).json({ success: false, error: msg });
  }
});

/**
 * POST /api/auth/forgot-password
 */
authRouter.post('/forgot-password', passwordResetLimiter, async (req, res) => {
  try {
    const parseResult = forgotPasswordSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ success: false, error: 'Valid email address is required.' });
      return;
    }

    const { email } = parseResult.data;
    const normalizedEmail = email.toLowerCase();

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail }
    });

    let resetToken: string | undefined;
    if (user) {
      const { rawToken } = await createPasswordResetToken(user.id);
      resetToken = rawToken;

      await recordAuditLog({
        userId: user.id,
        action: 'PASSWORD_RESET_REQUESTED',
        resourceType: 'user',
        resourceId: user.id,
        metadata: { email: normalizedEmail }
      });
    }

    // Always return generic success message to prevent user enumeration
    res.status(200).json({
      success: true,
      message: 'If an account with that email exists, password reset instructions have been sent.',
      // Return reset token in development or test mode for automated verification without external SMTP
      ...(process.env.NODE_ENV !== 'production' && resetToken ? { resetToken } : {})
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Password reset request failed';
    res.status(500).json({ success: false, error: msg });
  }
});

/**
 * POST /api/auth/reset-password
 */
authRouter.post('/reset-password', passwordResetLimiter, async (req, res) => {
  try {
    const parseResult = resetPasswordSchema.safeParse(req.body);
    if (!parseResult.success) {
      const errorMsg = parseResult.error.issues.map((e: { message: string }) => e.message).join('. ');
      res.status(400).json({ success: false, error: errorMsg });
      return;
    }

    const { token, password } = parseResult.data;
    await resetPasswordWithToken(token, password);

    res.status(200).json({
      success: true,
      message: 'Password reset successfully. You can now sign in with your new password.'
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Password reset failed';
    res.status(400).json({ success: false, error: msg });
  }
});

/**
 * POST /api/auth/change-password
 */
authRouter.post('/change-password', requireAuthenticatedUser, async (req: AuthenticatedRequest, res) => {
  try {
    const parseResult = changePasswordSchema.safeParse(req.body);
    if (!parseResult.success) {
      const errorMsg = parseResult.error.issues.map((e: { message: string }) => e.message).join('. ');
      res.status(400).json({ success: false, error: errorMsg });
      return;
    }

    const userId = req.authUser!.uid;
    const { currentPassword, newPassword } = parseResult.data;

    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user || !user.passwordHash) {
      res.status(400).json({
        success: false,
        error: 'Cannot change password on an account registered via Google OAuth without a password.'
      });
      return;
    }

    const isValid = await verifyPassword(currentPassword, user.passwordHash);
    if (!isValid) {
      res.status(401).json({ success: false, error: 'Current password is incorrect.' });
      return;
    }

    const newHash = await hashPassword(newPassword);

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { passwordHash: newHash }
      });

      // Revoke other refresh tokens
      await tx.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() }
      });

      await tx.auditLog.create({
        data: {
          userId,
          action: 'PASSWORD_CHANGED',
          resourceType: 'user',
          resourceId: userId
        }
      });
    });

    // Re-issue a fresh refresh token for the current session
    const { rawToken } = await createRefreshToken(userId);
    setRefreshTokenCookie(res, rawToken);

    res.status(200).json({
      success: true,
      message: 'Password changed successfully.'
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to change password';
    res.status(500).json({ success: false, error: msg });
  }
});

/**
 * GET /api/auth/google
 * Generates Google OAuth authorization URL
 */
authRouter.get('/google', (_req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3000/api/auth/google/callback';

  if (!clientId) {
    res.status(503).json({
      success: false,
      error: 'Google OAuth is not configured on this server.'
    });
    return;
  }

  const scope = encodeURIComponent('openid email profile');
  const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?response_type=code&client_id=${encodeURIComponent(
    clientId
  )}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}&access_type=offline&prompt=consent`;

  res.redirect(googleAuthUrl);
});

/**
 * GET /api/auth/google/callback
 * Handles OAuth 2.0 authorization code from Google
 */
authRouter.get('/google/callback', async (req, res) => {
  try {
    const code = req.query.code as string;
    if (!code) {
      res.redirect('/?error=google_auth_cancelled');
      return;
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3000/api/auth/google/callback';

    if (!clientId || !clientSecret) {
      res.redirect('/?error=google_auth_not_configured');
      return;
    }

    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code'
      })
    });

    const tokenData = (await tokenResponse.json()) as { id_token?: string; error?: string };
    if (!tokenResponse.ok || !tokenData.id_token) {
      throw new Error(tokenData.error || 'Failed to exchange authorization code with Google.');
    }

    const profile = await verifyGoogleToken(tokenData.id_token);
    const user = await authenticateOrLinkGoogleUser(profile);

    const { rawToken } = await createRefreshToken(user.id);
    setRefreshTokenCookie(res, rawToken);

    res.redirect('/app/overview?auth=google_success');
  } catch (err) {
    console.error('Google OAuth callback error:', err);
    res.redirect('/?error=google_auth_failed');
  }
});

/**
 * POST /api/auth/google/verify
 * Verifies Google ID Token from Google Identity Services button on frontend
 */
authRouter.post('/google/verify', authRateLimiter, async (req, res) => {
  try {
    const { credential } = req.body;
    if (!credential || typeof credential !== 'string') {
      res.status(400).json({ success: false, error: 'Google credential ID token is required.' });
      return;
    }

    const profile = await verifyGoogleToken(credential);
    const user = await authenticateOrLinkGoogleUser(profile);

    const accessToken = generateAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      fullName: user.fullName,
      emailVerified: user.emailVerified
    });

    const { rawToken } = await createRefreshToken(user.id);
    setRefreshTokenCookie(res, rawToken);

    res.status(200).json({
      success: true,
      data: {
        user: toUserProfile(user),
        accessToken
      }
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Google verification failed';
    res.status(401).json({ success: false, error: msg });
  }
});
