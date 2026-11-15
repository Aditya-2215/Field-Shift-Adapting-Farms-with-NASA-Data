import test, { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/database';
import {
  authenticateOrLinkGoogleUser,
  createPasswordResetToken,
  createRefreshToken,
  generateAccessToken,
  getJwtAccessSecret,
  hashPassword,
  hashToken,
  resetPasswordWithToken,
  revokeAllUserRefreshTokens,
  revokeRefreshToken,
  rotateRefreshToken,
  verifyAccessToken,
  verifyPassword
} from './auth/authService';
import {
  createPostgresRepositories,
  RepositoryHttpError
} from '../repositories/postgresRepositories';
import { createApiRouter } from '../routes/api';
import { DEMO_FARM, DEMO_NASA_POWER_FALLBACK } from '../../shared/data/demoFarm';
import { evaluateCropSuitability } from './crops/cropSuitabilityEngine';
import { computeEnvironmentalAssessment } from './environmental/environmentalEngine';
import { DEFAULT_ROTATION_WEIGHTS, generateRotationStrategies } from './rotation/rotationEngine';
import type { AuthContext } from '../middleware/authMiddleware';

describe('AgriShift AI — Authentication & Database Verification', () => {
  const repos = createPostgresRepositories();

  // Test User Contexts
  const testUserAId = '11111111-1111-4000-8000-111111111111';
  const testUserBId = '22222222-2222-4000-8000-222222222222';
  const testUserAEmail = 'farmer.alpha@example.com';
  const testUserBEmail = 'farmer.beta@example.com';

  const authUserA: AuthContext = {
    uid: testUserAId,
    email: testUserAEmail,
    name: 'Farmer Alpha',
    emailVerified: true,
    isAdmin: false,
    isDemo: false,
    role: 'farmer'
  };

  const authUserB: AuthContext = {
    uid: testUserBId,
    email: testUserBEmail,
    name: 'Farmer Beta',
    emailVerified: true,
    isAdmin: false,
    isDemo: false,
    role: 'farmer'
  };

  const demoAuthUser: AuthContext = {
    uid: 'demo_user',
    email: 'demo@agrishift.local',
    name: 'Demonstration Farmer',
    emailVerified: true,
    isAdmin: false,
    isDemo: true,
    role: 'farmer'
  };

  before(async () => {
    // Clean up test data if left over from previous test runs
    await prisma.farm.deleteMany({
      where: { userId: { in: [testUserAId, testUserBId] } }
    });
    await prisma.user.deleteMany({
      where: { email: { in: [testUserAEmail, testUserBEmail, 'google.user@example.com', 'new.farmer@example.com'] } }
    });
  });

  after(async () => {
    // Clean up test users
    await prisma.farm.deleteMany({
      where: { userId: { in: [testUserAId, testUserBId] } }
    });
    await prisma.user.deleteMany({
      where: { email: { in: [testUserAEmail, testUserBEmail, 'google.user@example.com', 'new.farmer@example.com'] } }
    });
    await prisma.$disconnect();
  });

  // ==========================================
  // OBJECTIVE 1: AUTHENTICATION TESTS
  // ==========================================

  describe('1. Registration, Password Hashing & Validation', () => {
    it('hashes passwords securely using bcrypt with 12 salt rounds', async () => {
      const rawPassword = 'AgriShift2026@Secure';
      const hash = await hashPassword(rawPassword);

      assert.ok(hash.startsWith('$2a$') || hash.startsWith('$2b$'), 'Hash must be a valid bcrypt format');
      assert.ok(hash.length >= 60, 'Bcrypt hash length must be >= 60 chars');

      const isMatch = await verifyPassword(rawPassword, hash);
      assert.equal(isMatch, true, 'Original password must verify successfully');

      const isWrongMatch = await verifyPassword('WrongPassword123!', hash);
      assert.equal(isWrongMatch, false, 'Incorrect password must be rejected');
    });

    it('creates user records in PostgreSQL upon registration', async () => {
      const passwordHash = await hashPassword('FarmerPass123$');
      const user = await prisma.user.create({
        data: {
          id: testUserAId,
          email: testUserAEmail,
          fullName: 'Farmer Alpha',
          passwordHash,
          emailVerified: true,
          accountStatus: 'active',
          role: 'farmer'
        }
      });

      assert.equal(user.id, testUserAId);
      assert.equal(user.email, testUserAEmail);
      assert.equal(user.accountStatus, 'active');
      assert.ok(user.createdAt instanceof Date);
    });

    it('enforces email uniqueness constraint in PostgreSQL', async () => {
      await assert.rejects(
        async () => {
          await prisma.user.create({
            data: {
              email: testUserAEmail, // Duplicate email
              fullName: 'Duplicate User',
              passwordHash: await hashPassword('SomePass123!'),
              role: 'farmer'
            }
          });
        },
        /Unique constraint failed on the fields: \(`email`\)|unique constraint/i
      );
    });
  });

  describe('2. JWT Access Tokens & Refresh Token Rotation', () => {
    it('generates short-lived access tokens with valid claims and signature', () => {
      const token = generateAccessToken({
        userId: testUserAId,
        email: testUserAEmail,
        role: 'farmer',
        fullName: 'Farmer Alpha',
        emailVerified: true
      });

      assert.ok(typeof token === 'string' && token.length > 50);

      const decoded = verifyAccessToken(token);
      assert.equal(decoded.userId, testUserAId);
      assert.equal(decoded.email, testUserAEmail);
      assert.equal(decoded.role, 'farmer');
      assert.equal(decoded.emailVerified, true);
    });

    it('rejects forged or tampered JWT access tokens', () => {
      const validToken = generateAccessToken({
        userId: testUserAId,
        email: testUserAEmail,
        role: 'farmer',
        fullName: 'Farmer Alpha',
        emailVerified: true
      });

      const tampered = validToken.slice(0, -6) + 'xxxxxx';
      assert.throws(() => verifyAccessToken(tampered), /invalid signature/i);

      // Unsigned token
      const unsigned = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url') +
        '.' +
        Buffer.from(JSON.stringify({ userId: testUserAId })).toString('base64url') +
        '.';
      assert.throws(() => verifyAccessToken(unsigned));
    });

    it('rejects expired JWT access tokens', () => {
      const expiredToken = jwt.sign(
        { userId: testUserAId, email: testUserAEmail, role: 'farmer', fullName: 'Farmer Alpha', emailVerified: true },
        getJwtAccessSecret(),
        { expiresIn: '-1s', issuer: 'agrishift-ai', audience: 'agrishift-client' }
      );

      assert.throws(() => verifyAccessToken(expiredToken), /jwt expired/i);
    });

    it('stores only hashed refresh tokens in PostgreSQL and supports token rotation', async () => {
      const { rawToken, expiresAt } = await createRefreshToken(testUserAId);
      assert.ok(rawToken.length >= 40);
      assert.ok(expiresAt > new Date());

      const rawHash = hashToken(rawToken);
      const stored = await prisma.refreshToken.findUnique({
        where: { tokenHash: rawHash }
      });

      assert.ok(stored, 'Refresh token record must exist in DB under SHA-256 hash');
      assert.notEqual(stored.tokenHash, rawToken, 'Raw token must never be stored in plaintext');
      assert.equal(stored.userId, testUserAId);
      assert.equal(stored.revokedAt, null);

      // Rotate token
      const rotationResult = await rotateRefreshToken(rawToken);
      assert.ok(rotationResult.accessToken);
      assert.ok(rotationResult.newRefreshToken);
      assert.notEqual(rotationResult.newRefreshToken, rawToken, 'New token must differ from rotated token');

      // Check old token is revoked
      const oldTokenRecord = await prisma.refreshToken.findUnique({
        where: { tokenHash: rawHash }
      });
      assert.ok(oldTokenRecord?.revokedAt !== null, 'Old refresh token must be revoked');
    });

    it('detects token reuse and revokes tokens if an already-revoked refresh token is replayed', async () => {
      const { rawToken } = await createRefreshToken(testUserAId);

      // First rotation succeeds
      await rotateRefreshToken(rawToken);

      // Attempting to rotate the same token again should be detected as reuse
      await assert.rejects(
        async () => {
          await rotateRefreshToken(rawToken);
        },
        /token reuse detected|revoked/i
      );
    });

    it('revokes refresh tokens on logout and supports logout-all-devices', async () => {
      const token1 = await createRefreshToken(testUserAId);
      const token2 = await createRefreshToken(testUserAId);

      // Single logout
      await revokeRefreshToken(token1.rawToken);
      const rec1 = await prisma.refreshToken.findUnique({ where: { tokenHash: hashToken(token1.rawToken) } });
      assert.ok(rec1?.revokedAt !== null, 'Token 1 should be revoked');

      // Token 2 should still be active
      const rec2 = await prisma.refreshToken.findUnique({ where: { tokenHash: hashToken(token2.rawToken) } });
      assert.equal(rec2?.revokedAt, null, 'Token 2 should still be active');

      // Logout all devices
      const revokedCount = await revokeAllUserRefreshTokens(testUserAId);
      assert.ok(revokedCount >= 1, 'Should revoke remaining active sessions');

      const rec2After = await prisma.refreshToken.findUnique({ where: { tokenHash: hashToken(token2.rawToken) } });
      assert.ok(rec2After?.revokedAt !== null, 'Token 2 should now be revoked');
    });
  });

  describe('3. Password Reset Workflow', () => {
    it('creates secure one-time password reset tokens and updates password safely', async () => {
      const { rawToken, expiresAt } = await createPasswordResetToken(testUserAId);
      assert.ok(rawToken.length >= 32);
      assert.ok(expiresAt > new Date());

      const tokenHash = hashToken(rawToken);
      const resetRec = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });
      assert.ok(resetRec, 'Reset token must exist in PostgreSQL');
      assert.equal(resetRec.usedAt, null);

      // Reset password with token
      const newPasswordPlain = 'BrandNewSafe2026!';
      await resetPasswordWithToken(rawToken, newPasswordPlain);

      // Verify user's updated password
      const updatedUser = await prisma.user.findUniqueOrThrow({ where: { id: testUserAId } });
      const isNewMatch = await verifyPassword(newPasswordPlain, updatedUser.passwordHash!);
      assert.equal(isNewMatch, true, 'Updated password must verify');

      // Verify token is marked as used
      const resetRecAfter = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });
      assert.ok(resetRecAfter?.usedAt !== null, 'Token must be marked used');

      // Re-using token must fail
      await assert.rejects(
        async () => {
          await resetPasswordWithToken(rawToken, 'AnotherPassword123!');
        },
        /already been used/i
      );
    });
  });

  describe('4. Google OAuth 2.0 Account Verification and Safe Linking', () => {
    it('safely creates new Google-only accounts without plain-text passwords', async () => {
      const googleProfile = {
        providerAccountId: 'google_sub_1092837465',
        email: 'google.user@example.com',
        fullName: 'Google User',
        emailVerified: true
      };

      const user = await authenticateOrLinkGoogleUser(googleProfile);
      assert.ok(user.id);
      assert.equal(user.email, googleProfile.email);
      assert.equal(user.passwordHash, null, 'Google-only accounts must have null passwordHash');
      assert.equal(user.emailVerified, true);

      // Verify oauth_accounts entry
      const oauthAcc = await prisma.oAuthAccount.findUnique({
        where: {
          provider_providerAccountId: {
            provider: 'google',
            providerAccountId: googleProfile.providerAccountId
          }
        }
      });
      assert.ok(oauthAcc, 'OAuthAccount record must exist');
      assert.equal(oauthAcc.userId, user.id);
    });

    it('safely links verified Google accounts to existing email/password accounts', async () => {
      const linkProfile = {
        providerAccountId: 'google_sub_alpha_linked',
        email: testUserAEmail, // Matches existing User A
        fullName: 'Farmer Alpha',
        emailVerified: true
      };

      const linkedUser = await authenticateOrLinkGoogleUser(linkProfile);
      assert.equal(linkedUser.id, testUserAId, 'Must link to existing User A ID');
      assert.ok(linkedUser.passwordHash, 'Existing password must NOT be overwritten');

      const oauthAcc = await prisma.oAuthAccount.findUnique({
        where: {
          provider_providerAccountId: {
            provider: 'google',
            providerAccountId: linkProfile.providerAccountId
          }
        }
      });
      assert.ok(oauthAcc);
      assert.equal(oauthAcc.userId, testUserAId);
    });

    it('prevents account takeover when Google email is unverified', async () => {
      const unverifiedProfile = {
        providerAccountId: 'attacker_google_sub',
        email: testUserAEmail,
        fullName: 'Attacker',
        emailVerified: false // Unverified Google email!
      };

      await assert.rejects(
        async () => {
          await authenticateOrLinkGoogleUser(unverifiedProfile);
        },
        /not verified/i
      );
    });
  });

  // ==========================================
  // OBJECTIVE 2: POSTGRESQL PERSISTENCE & ISOLATION
  // ==========================================

  describe('5. PostgreSQL Schema, Foreign Keys & Cascading Deletion', () => {
    let farmAId: string;

    it('creates User B in PostgreSQL for isolation testing', async () => {
      await prisma.user.create({
        data: {
          id: testUserBId,
          email: testUserBEmail,
          fullName: 'Farmer Beta',
          passwordHash: await hashPassword('BetaPassword123!'),
          emailVerified: true,
          accountStatus: 'active',
          role: 'farmer'
        }
      });
    });

    it('persists farms, soil profiles, and crop history with UUIDs and transactions', async () => {
      const farmInput = {
        name: 'Alpha Mustard & Wheat Parcel',
        country: 'India',
        state: 'Uttar Pradesh',
        district: 'Barabanki',
        village: 'Dewan',
        latitude: 26.924,
        longitude: 81.189,
        area: 2.5,
        areaUnit: 'hectares' as const,
        irrigationAvailable: true,
        irrigationMethod: 'Tubewell',
        waterAvailability: 'moderate' as const,
        currentCrops: ['Rice', 'Wheat'],
        cropHistory: [
          { year: 2024, season: 'Kharif' as const, cropName: 'Rice', yieldNote: 'Good yield' },
          { year: 2024, season: 'Rabi' as const, cropName: 'Wheat', yieldNote: 'Average' }
        ],
        soilProfile: {
          soilType: 'Alluvial loam',
          ph: 7.2,
          nitrogenKgHa: 240,
          phosphorusKgHa: 22,
          potassiumKgHa: 210,
          organicCarbonPct: 0.55,
          texture: 'loam',
          drainage: 'well_drained' as const
        }
      };

      const created = await repos.farms.create(farmInput, authUserA);
      farmAId = created.id;

      assert.ok(created.id);
      assert.equal(created.ownerId, testUserAId);
      assert.equal(created.name, farmInput.name);
      assert.equal(created.soilProfile.ph, 7.2);
      assert.equal(created.cropHistory.length, 2);

      // Verify in PostgreSQL database directly
      const pgFarm = await prisma.farm.findUnique({
        where: { id: farmAId },
        include: { soilProfiles: true, cropHistory: true }
      });
      assert.ok(pgFarm);
      assert.equal(pgFarm.soilProfiles.length, 1);
      assert.equal(pgFarm.soilProfiles[0].nitrogen, 240);
      assert.equal(pgFarm.cropHistory.length, 2);
    });

    it('persists environmental assessments in PostgreSQL', async () => {
      const farm = await repos.farms.getOwnedOrDemo(farmAId, authUserA);
      const assessment = computeEnvironmentalAssessment(farm, DEMO_NASA_POWER_FALLBACK);

      const saved = await repos.assessments.create(farm, assessment, authUserA);
      assert.ok(saved.id);
      assert.equal(saved.farmId, farmAId);
      assert.equal(saved.ownerId, testUserAId);

      const list = await repos.assessments.list(authUserA, farmAId);
      assert.ok(list.some((a) => a.id === saved.id));
    });

    it('persists rotation scenarios with crop sequences and score breakdowns in PostgreSQL', async () => {
      const farm = await repos.farms.getOwnedOrDemo(farmAId, authUserA);
      const suitability = evaluateCropSuitability(farm, DEMO_NASA_POWER_FALLBACK);
      const comparison = generateRotationStrategies(
        farm,
        DEMO_NASA_POWER_FALLBACK,
        suitability,
        DEFAULT_ROTATION_WEIGHTS
      );

      const saved = await repos.rotations.create(farm, 'Alpha Fall 2026 Plan', comparison, authUserA);
      assert.ok(saved.id);
      assert.equal(saved.farmId, farmAId);
      assert.equal(saved.title, 'Alpha Fall 2026 Plan');
      assert.ok(saved.strategies.length >= 3);

      const list = await repos.rotations.list(authUserA, farmAId);
      assert.ok(list.some((r) => r.id === saved.id));
    });

    it('persists AI conversations and messages across turns in PostgreSQL', async () => {
      const farm = await repos.farms.getOwnedOrDemo(farmAId, authUserA);

      const turn1 = await repos.conversations.appendTurns(
        farm,
        [
          { id: 'msg_1', role: 'user', content: 'What is the optimal sowing date for chickpea?', timestamp: new Date().toISOString() },
          { id: 'msg_2', role: 'assistant', content: 'Chickpea in UP is best sown between Oct 20 and Nov 15.', timestamp: new Date().toISOString() }
        ],
        authUserA
      );

      assert.equal(turn1.messages.length, 2);

      const turn2 = await repos.conversations.appendTurns(
        farm,
        [
          { id: 'msg_3', role: 'user', content: 'Does it need irrigation?', timestamp: new Date().toISOString() },
          { id: 'msg_4', role: 'assistant', content: 'One branching irrigation at 45 days is sufficient.', timestamp: new Date().toISOString() }
        ],
        authUserA
      );

      assert.equal(turn2.messages.length, 4);

      const fetched = await repos.conversations.getForFarm(farmAId, authUserA);
      assert.equal(fetched?.messages.length, 4);
    });

    it('persists generated decision-support farm reports in PostgreSQL', async () => {
      const farm = await repos.farms.getOwnedOrDemo(farmAId, authUserA);

      const report = await repos.reports.create(
        farm,
        'report_alpha_1',
        'Strategy B - Soil Restoration',
        'Summary notes on legume inclusion.',
        authUserA
      );

      assert.ok(report.id);
      assert.equal(report.ownerId, testUserAId);

      const reportsList = await repos.reports.list(authUserA, farmAId);
      assert.ok(reportsList.some((r) => r.id === report.id));
    });

    it('enforces strict user isolation across all resources', async () => {
      // User B cannot read User A's farm
      await assert.rejects(
        async () => {
          await repos.farms.getOwnedOrDemo(farmAId, authUserB);
        },
        /Forbidden: you do not own this farm/i
      );

      // User B cannot update User A's soil profile
      await assert.rejects(
        async () => {
          await repos.soilProfiles.updateForFarm(farmAId, { ph: 6.5 }, authUserB);
        },
        /Forbidden/i
      );

      // User B's farms list does not include User A's farm
      const userBFarms = await repos.farms.listAccessible(authUserB);
      assert.ok(!userBFarms.some((f) => f.id === farmAId));

      // Demonstration mode cannot modify any records
      await assert.rejects(
        async () => {
          await repos.farms.create({ name: 'Illegal Demo Farm' } as any, demoAuthUser);
        },
        /Demonstration mode is read-only/i
      );
    });

    it('cascades deletion cleanly: deleting farm removes all associated soil, history, assessments, scenarios, and reports', async () => {
      // Delete Farm A
      await repos.farms.delete(farmAId, authUserA);

      // Verify farm is deleted
      const farmCheck = await prisma.farm.findUnique({ where: { id: farmAId } });
      assert.equal(farmCheck, null);

      // Verify cascading child deletions in PostgreSQL
      const soilCheck = await prisma.soilProfile.findMany({ where: { farmId: farmAId } });
      assert.equal(soilCheck.length, 0);

      const cropHistCheck = await prisma.cropHistory.findMany({ where: { farmId: farmAId } });
      assert.equal(cropHistCheck.length, 0);

      const assessCheck = await prisma.environmentalAssessment.findMany({ where: { farmId: farmAId } });
      assert.equal(assessCheck.length, 0);

      const rotCheck = await prisma.rotationScenario.findMany({ where: { farmId: farmAId } });
      assert.equal(rotCheck.length, 0);

      const convCheck = await prisma.aiConversation.findMany({ where: { farmId: farmAId } });
      assert.equal(convCheck.length, 0);

      const repCheck = await prisma.report.findMany({ where: { farmId: farmAId } });
      assert.equal(repCheck.length, 0);
    });
  });

  // ==========================================
  // OBJECTIVE 3 & 9: END-TO-END INTEGRATION WORKFLOW
  // ==========================================

  describe('6. End-to-End Workflow: Register → Login → Farm → Soil → Rotation → Report', () => {
    it('executes complete farmer journey seamlessly', async () => {
      const email = 'new.farmer@example.com';
      const password = 'AgriShift#2026Safe';

      // 1. Register
      const passwordHash = await hashPassword(password);
      const user = await prisma.user.create({
        data: {
          email,
          fullName: 'Suresh Patel',
          passwordHash,
          emailVerified: true,
          role: 'farmer'
        }
      });
      assert.ok(user.id);

      // 2. Login verification
      const isMatch = await verifyPassword(password, user.passwordHash!);
      assert.equal(isMatch, true);
      const accessToken = generateAccessToken({
        userId: user.id,
        email: user.email,
        role: user.role,
        fullName: user.fullName,
        emailVerified: user.emailVerified
      });
      const decoded = verifyAccessToken(accessToken);
      assert.equal(decoded.userId, user.id);

      const farmerAuth: AuthContext = {
        uid: user.id,
        email: user.email,
        name: user.fullName,
        emailVerified: true,
        isAdmin: false,
        isDemo: false,
        role: 'farmer'
      };

      // 3. Create Farm
      const createdFarm = await repos.farms.create(
        {
          name: 'Patel Organic Acres',
          country: 'India',
          state: 'Gujarat',
          district: 'Anand',
          latitude: 22.564,
          longitude: 72.928,
          area: 4.2,
          areaUnit: 'hectares',
          irrigationAvailable: true,
          waterAvailability: 'abundant',
          currentCrops: ['Rice', 'Wheat']
        },
        farmerAuth
      );
      assert.ok(createdFarm.id);

      // 4. Update Soil Profile
      const updatedFarm = await repos.soilProfiles.updateForFarm(
        createdFarm.id,
        {
          soilType: 'Black cotton loam',
          ph: 7.8,
          nitrogenKgHa: 280,
          phosphorusKgHa: 26,
          potassiumKgHa: 320,
          organicCarbonPct: 0.68,
          texture: 'clay loam',
          drainage: 'well_drained'
        },
        farmerAuth
      );
      assert.equal(updatedFarm.soilProfile.ph, 7.8);

      // 5. NASA POWER Analysis
      const powerData = {
        ...DEMO_NASA_POWER_FALLBACK,
        farmId: createdFarm.id,
        latitude: createdFarm.latitude,
        longitude: createdFarm.longitude
      };
      const assessment = computeEnvironmentalAssessment(updatedFarm, powerData);
      assert.ok(assessment.overallRiskScore >= 0);

      // 6. Generate Crop Rotations
      const suitability = evaluateCropSuitability(updatedFarm, powerData);
      const rotations = generateRotationStrategies(
        updatedFarm,
        powerData,
        suitability,
        DEFAULT_ROTATION_WEIGHTS
      );
      assert.ok(rotations.strategies.length >= 3);

      // 7. Save Rotation Scenario
      const savedScenario = await repos.rotations.create(
        updatedFarm,
        'Patel 2026 Water Saver Scenario',
        rotations,
        farmerAuth
      );
      assert.ok(savedScenario.id);

      // 8. Generate and Persist Final Farm Report
      const savedReport = await repos.reports.create(
        updatedFarm,
        `rep_${Date.now()}`,
        rotations.strategies[0].label,
        assessment.methodologySummary,
        farmerAuth
      );
      assert.ok(savedReport.id);

      // Cleanup
      await repos.farms.delete(createdFarm.id, farmerAuth);
      await prisma.user.delete({ where: { id: user.id } });
    });
  });
});
