import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import { prisma } from '../../config/database';

const BCRYPT_SALT_ROUNDS = 12;
const ACCESS_TOKEN_EXPIRY = '15m'; // 15 minutes
const REFRESH_TOKEN_DAYS = 7;
const RESET_TOKEN_HOURS = 1;

export function getJwtAccessSecret(): string {
  const secret = process.env.JWT_ACCESS_SECRET;
  if (!secret || secret.trim().length < 16) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('JWT_ACCESS_SECRET must be set and at least 16 characters long in production.');
    }
    return 'agrishift_dev_fallback_jwt_access_secret_2026_xyz';
  }
  return secret;
}

export function getJwtRefreshSecret(): string {
  const secret = process.env.JWT_REFRESH_SECRET;
  if (!secret || secret.trim().length < 16) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('JWT_REFRESH_SECRET must be set and at least 16 characters long in production.');
    }
    return 'agrishift_dev_fallback_jwt_refresh_secret_2026_abc';
  }
  return secret;
}

export interface AccessTokenPayload {
  userId: string;
  email: string;
  role: string;
  fullName: string;
  emailVerified: boolean;
  iat?: number;
  exp?: number;
}

export interface GoogleVerifiedProfile {
  providerAccountId: string;
  email: string;
  fullName: string;
  emailVerified: boolean;
}

let cachedGoogleClient: OAuth2Client | null = null;
function getGoogleOAuthClient(): OAuth2Client {
  if (!cachedGoogleClient) {
    const clientId = process.env.GOOGLE_CLIENT_ID || '';
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET || '';
    const redirectUri = process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3000/api/auth/google/callback';
    cachedGoogleClient = new OAuth2Client(clientId, clientSecret, redirectUri);
  }
  return cachedGoogleClient;
}

/**
 * Hash a plain text password using bcrypt with 12 salt rounds
 */
export async function hashPassword(plainText: string): Promise<string> {
  return bcrypt.hash(plainText, BCRYPT_SALT_ROUNDS);
}

/**
 * Compare plain text password against a bcrypt hash
 */
export async function verifyPassword(plainText: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plainText, hash);
}

/**
 * Hash a token (refresh token or reset token) with SHA-256 before database storage
 */
export function hashToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

/**
 * Generate a random cryptographically secure token string
 */
export function generateRandomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('hex');
}

/**
 * Generate a short-lived (15 minutes) JWT access token
 */
export function generateAccessToken(payload: {
  userId: string;
  email: string;
  role: string;
  fullName: string;
  emailVerified: boolean;
}): string {
  return jwt.sign(
    {
      userId: payload.userId,
      email: payload.email,
      role: payload.role,
      fullName: payload.fullName,
      emailVerified: payload.emailVerified
    },
    getJwtAccessSecret(),
    {
      expiresIn: ACCESS_TOKEN_EXPIRY,
      issuer: 'agrishift-ai',
      audience: 'agrishift-client'
    }
  );
}

/**
 * Verify and decode a JWT access token
 */
export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, getJwtAccessSecret(), {
    issuer: 'agrishift-ai',
    audience: 'agrishift-client'
  }) as AccessTokenPayload;
}

/**
 * Create a new rotating refresh token in PostgreSQL
 */
export async function createRefreshToken(userId: string): Promise<{ rawToken: string; expiresAt: Date }> {
  const rawToken = generateRandomToken(40);
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000);

  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash,
      expiresAt
    }
  });

  return { rawToken, expiresAt };
}

/**
 * Rotate an existing refresh token:
 * Validates, revokes old token, and issues a new access token and refresh token.
 */
export async function rotateRefreshToken(rawToken: string): Promise<{
  accessToken: string;
  newRefreshToken: string;
  user: { id: string; email: string; role: string; fullName: string; emailVerified: boolean };
}> {
  const tokenHash = hashToken(rawToken);

  const existingToken = await prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: { user: true }
  });

  if (!existingToken) {
    throw new Error('Invalid refresh token.');
  }

  // Token reuse detection: if already revoked, revoke all tokens for this user as a security safeguard
  if (existingToken.revokedAt) {
    await prisma.refreshToken.updateMany({
      where: { userId: existingToken.userId, revokedAt: null },
      data: { revokedAt: new Date() }
    });
    throw new Error('Refresh token has been revoked. Possible token reuse detected.');
  }

  if (existingToken.expiresAt < new Date()) {
    throw new Error('Refresh token has expired. Please log in again.');
  }

  if (existingToken.user.accountStatus !== 'active') {
    throw new Error('Account is suspended or inactive.');
  }

  // Revoke current token
  await prisma.refreshToken.update({
    where: { id: existingToken.id },
    data: { revokedAt: new Date() }
  });

  // Issue new refresh token
  const { rawToken: newRefreshToken } = await createRefreshToken(existingToken.userId);

  // Issue new access token
  const accessToken = generateAccessToken({
    userId: existingToken.user.id,
    email: existingToken.user.email,
    role: existingToken.user.role,
    fullName: existingToken.user.fullName,
    emailVerified: existingToken.user.emailVerified
  });

  return {
    accessToken,
    newRefreshToken,
    user: {
      id: existingToken.user.id,
      email: existingToken.user.email,
      role: existingToken.user.role,
      fullName: existingToken.user.fullName,
      emailVerified: existingToken.user.emailVerified
    }
  };
}

/**
 * Revoke a specific refresh token (Logout)
 */
export async function revokeRefreshToken(rawToken: string): Promise<void> {
  const tokenHash = hashToken(rawToken);
  await prisma.refreshToken.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: new Date() }
  });
}

/**
 * Revoke all active refresh tokens for a user (Logout all devices)
 */
export async function revokeAllUserRefreshTokens(userId: string): Promise<number> {
  const result = await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() }
  });
  return result.count;
}

/**
 * Create a password reset token with 1-hour expiration
 */
export async function createPasswordResetToken(userId: string): Promise<{ rawToken: string; expiresAt: Date }> {
  // Invalidate any existing active reset tokens for this user
  await prisma.passwordResetToken.updateMany({
    where: { userId, usedAt: null },
    data: { usedAt: new Date() }
  });

  const rawToken = generateRandomToken(32);
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + RESET_TOKEN_HOURS * 60 * 60 * 1000);

  await prisma.passwordResetToken.create({
    data: {
      userId,
      tokenHash,
      expiresAt
    }
  });

  return { rawToken, expiresAt };
}

/**
 * Consume a password reset token and update user password
 */
export async function resetPasswordWithToken(rawToken: string, newPasswordPlain: string): Promise<void> {
  const tokenHash = hashToken(rawToken);

  const resetRecord = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    include: { user: true }
  });

  if (!resetRecord) {
    throw new Error('Invalid or expired password reset token.');
  }

  if (resetRecord.usedAt) {
    throw new Error('This password reset token has already been used.');
  }

  if (resetRecord.expiresAt < new Date()) {
    throw new Error('Password reset token has expired.');
  }

  const newHash = await hashPassword(newPasswordPlain);

  await prisma.$transaction(async (tx) => {
    // Update password and ensure email_verified is true
    await tx.user.update({
      where: { id: resetRecord.userId },
      data: {
        passwordHash: newHash,
        emailVerified: true
      }
    });

    // Mark token used
    await tx.passwordResetToken.update({
      where: { id: resetRecord.id },
      data: { usedAt: new Date() }
    });

    // Revoke all existing sessions for safety
    await tx.refreshToken.updateMany({
      where: { userId: resetRecord.userId, revokedAt: null },
      data: { revokedAt: new Date() }
    });

    // Audit log
    await tx.auditLog.create({
      data: {
        userId: resetRecord.userId,
        action: 'PASSWORD_RESET_SUCCESS',
        resourceType: 'user',
        resourceId: resetRecord.userId,
        metadata: { timestamp: new Date().toISOString() }
      }
    });
  });
}

/**
 * Verify Google ID Token (from Google One Tap, popup credential, or OAuth callback)
 */
export async function verifyGoogleToken(idToken: string): Promise<GoogleVerifiedProfile> {
  const client = getGoogleOAuthClient();
  const clientId = process.env.GOOGLE_CLIENT_ID;

  const ticket = await client.verifyIdToken({
    idToken,
    audience: clientId || undefined
  });

  const payload = ticket.getPayload();
  if (!payload || !payload.email || !payload.sub) {
    throw new Error('Invalid Google ID token payload.');
  }

  return {
    providerAccountId: payload.sub,
    email: payload.email.toLowerCase().trim(),
    fullName: payload.name || payload.email.split('@')[0],
    emailVerified: Boolean(payload.email_verified)
  };
}

/**
 * Safe Google Account Login/Linking
 * - If OAuth account already linked: logs in.
 * - If user with same email exists and is email_verified by Google: links safely.
 * - If no user exists: creates new user and links OAuth account.
 */
export async function authenticateOrLinkGoogleUser(profile: GoogleVerifiedProfile) {
  return prisma.$transaction(async (tx) => {
    // 1. Check if OAuth account is already registered
    const existingOAuth = await tx.oAuthAccount.findUnique({
      where: {
        provider_providerAccountId: {
          provider: 'google',
          providerAccountId: profile.providerAccountId
        }
      },
      include: { user: true }
    });

    if (existingOAuth) {
      if (existingOAuth.user.accountStatus !== 'active') {
        throw new Error('Account is suspended or inactive.');
      }
      return existingOAuth.user;
    }

    // 2. Check if user with that email already exists
    const existingUser = await tx.user.findUnique({
      where: { email: profile.email }
    });

    if (existingUser) {
      if (existingUser.accountStatus !== 'active') {
        throw new Error('Account is suspended or inactive.');
      }

      // Safe linking: Only link if Google email is verified
      if (!profile.emailVerified) {
        throw new Error('Google account email is not verified. Cannot safely link account.');
      }

      // Link OAuth account to existing user
      await tx.oAuthAccount.create({
        data: {
          userId: existingUser.id,
          provider: 'google',
          providerAccountId: profile.providerAccountId
        }
      });

      // Update emailVerified flag if not set
      if (!existingUser.emailVerified) {
        await tx.user.update({
          where: { id: existingUser.id },
          data: { emailVerified: true }
        });
      }

      await tx.auditLog.create({
        data: {
          userId: existingUser.id,
          action: 'GOOGLE_OAUTH_LINKED',
          resourceType: 'oauth_account',
          resourceId: profile.providerAccountId,
          metadata: { email: profile.email }
        }
      });

      return existingUser;
    }

    // 3. New Google-only user
    const newUser = await tx.user.create({
      data: {
        email: profile.email,
        fullName: profile.fullName,
        passwordHash: null, // Google-only account
        emailVerified: profile.emailVerified,
        accountStatus: 'active',
        role: 'farmer',
        oauthAccounts: {
          create: {
            provider: 'google',
            providerAccountId: profile.providerAccountId
          }
        }
      }
    });

    await tx.auditLog.create({
      data: {
        userId: newUser.id,
        action: 'GOOGLE_OAUTH_REGISTERED',
        resourceType: 'user',
        resourceId: newUser.id,
        metadata: { email: profile.email }
      }
    });

    return newUser;
  });
}

/**
 * Audit log recording helper
 */
export async function recordAuditLog(params: {
  userId?: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: params.userId || null,
        action: params.action,
        resourceType: params.resourceType,
        resourceId: params.resourceId || null,
        metadata: (params.metadata as any) ?? undefined
      }
    });
  } catch (err) {
    console.error('Audit log write error:', err);
  }
}
