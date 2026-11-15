# AgriShift AI — Database & Authentication Migration Documentation

## Executive Summary
This document records the architectural migration of AgriShift AI from Google Firebase Authentication and Cloud Firestore to a self-hosted, enterprise-grade relational database architecture powered by PostgreSQL, Prisma ORM, and JWT authentication.

---

## 1. Authentication Migration: Firebase Auth to JWT + OAuth 2.0

### Former State
- Client-side Firebase Web SDK (`firebase/auth`) coupled directly to Google authentication dialogs.
- Session state tied to Firebase auth tokens without fine-grained control over session lifetime, token revocation, or server-side password hashing.

### Modern Implementation
1. **Primary Email / Password Authentication**:
   - Cryptographic password hashing using `bcryptjs` with 12 salt rounds.
   - User creation and validation in PostgreSQL `users` table.
   - Email uniqueness and format validation via Zod schemas.
   - Password strength validation: minimum 8 characters, uppercase, lowercase, numeric, and special character requirements.
2. **Dual-Token Session Lifecycle**:
   - **Access Token**: Short-lived (15 minutes) signed JSON Web Token (JWT) with user ID, email, verified status, and role claims. Kept exclusively in memory in the frontend `apiClient` singleton; never persisted to `localStorage` or `sessionStorage` to mitigate XSS exposure.
   - **Refresh Token**: 7-day cryptographically random 64-character token. Stored only as a SHA-256 hash in PostgreSQL `refresh_tokens` table. Delivered over `HttpOnly`, `SameSite=Lax`, `Secure` (in production) cookies with path `/api/auth`.
   - **Token Rotation & Reuse Detection**: Each `/api/auth/refresh` invocation revokes the old refresh token and issues a fresh one. If an already-revoked refresh token is presented (potential replay or theft), all active refresh tokens for that user account are immediately revoked.
   - **Device Revocation**: Supports `/api/auth/logout` (single session) and `/api/auth/logout-all` (all sessions across all devices).
3. **Password Management Workflows**:
   - **Forgot Password**: Generates a 64-character hex reset token, stores its SHA-256 hash in `password_reset_tokens` with 1-hour expiration.
   - **Reset Password**: Validates and consumes the one-time token in a transaction to prevent replay.
   - **Change Password**: Validates current password before hashing and saving the new password.
4. **Secondary Google OAuth 2.0**:
   - Retained as an optional secondary login mechanism.
   - Client passes Google ID token to `/api/auth/google/verify` or uses Google OAuth redirect flow.
   - Server-side verification using Google's official `google-auth-library`.
   - Safe account linking: Existing email accounts are only linked if Google confirms `email_verified: true`. If unverified, linking is rejected to eliminate account takeover vulnerabilities.
   - Issues identical application JWT access and refresh tokens.

---

## 2. Database Migration: Firestore to PostgreSQL (Prisma ORM)

### Former State
- Unstructured NoSQL collections in Cloud Firestore: `farms`, `soil_profiles`, `crop_history`, `environmental_assessments`, `rotation_scenarios`, `ai_conversations`, `reports`.
- Required flattening coordinates to avoid Firestore nested array restrictions.
- Lack of database-enforced relational integrity, cascading deletions, or foreign keys.

### Modern Implementation
- **17 Normalized Relational Tables**:
  - `users` (UUID, email index, unique)
  - `oauth_accounts` (UUID, user FK, provider index, unique compound)
  - `refresh_tokens` (UUID, user FK, token hash index)
  - `password_reset_tokens` (UUID, user FK, token hash index)
  - `farms` (UUID, user FK, coordinates, JSONB boundary, indexes on userId and lat/lon)
  - `soil_profiles` (UUID, farm FK, 1-to-1 unique relation, cascading delete)
  - `crop_history` (UUID, farm FK, year/season index)
  - `environmental_observations` (UUID, farm FK, parameter/date index)
  - `environmental_assessments` (UUID, farm FK, date/risk index)
  - `crop_knowledge` (UUID, crop name unique, 17 seeded ICAR/FAO profiles)
  - `farmer_preferences` (UUID, user FK, farm FK, priority weights)
  - `rotation_scenarios` (UUID, farm FK, user FK, strategy index)
  - `ai_conversations` (UUID, user FK, farm FK, updated_at index)
  - `ai_messages` (UUID, conversation FK, role, created_at index, cascading delete)
  - `reports` (UUID, user FK, farm FK, created_at index)
  - `notifications` (UUID, user FK, read_at index)
  - `audit_logs` (UUID, user FK nullable, action, resource index)
- **Data Integrity & Cascading Behavior**:
  - Deleting a `Farm` automatically cascades deletion to its `soil_profiles`, `crop_history`, `environmental_observations`, `environmental_assessments`, `farmer_preferences`, `rotation_scenarios`, `ai_conversations`, and `reports`.
  - Deleting a `User` cascades deletion to their farms, OAuth accounts, refresh tokens, password reset tokens, and notifications.
- **Repository Architecture**:
  - Implemented `server/repositories/postgresRepositories.ts` using Prisma Client.
  - Transactions ensure atomicity for multi-step operations (e.g. farm creation + initial soil profile initialization).
  - Strict user boundary checks: `assertOwnership(resource.userId, authUser)`.

---

## 3. Step-by-Step Migration & Verification Procedure

1. **Schema & Migration Creation**:
   - Defined `prisma/schema.prisma` with all 17 tables and indexes.
   - Generated initial migration: `prisma/migrations/20261114170251_init/migration.sql`.
   - Applied migration with `npx prisma migrate deploy`.
2. **Crop Knowledge & Demonstration Seeding**:
   - Seed script `prisma/seed.ts` upserted all 17 ICAR/FAO agronomic profiles (Wheat, Rice, Maize, Chickpea, Pigeonpea, Pearl Millet, Mustard, Cotton, etc.).
   - Seeded demo farm parcel (`demo_up_barabanki_01`) and demo soil profile.
3. **Automated End-to-End Verification**:
   - Suite `server/services/authAndDb.test.ts` executes 29 automated tests covering:
     - Password hashing with 12 salt rounds
     - User creation and email uniqueness
     - JWT access token signing, tampering rejection, and expiration
     - Refresh token hashing, rotation, and reuse revocation
     - Password reset token generation and one-time consumption
     - Google OAuth safe linking and unverified email rejection
     - PostgreSQL parcel, soil, history, assessment, scenario, conversation, and report persistence
     - Cross-user tenant isolation
     - Foreign key cascading deletions
     - Complete end-to-end farmer journey

---

## 4. Manual Retirement Procedure for Old Firebase Project

Because the active application no longer utilizes Firebase:
1. **Preserve Backups**: Ensure all historical data in Firestore has been archived if necessary:
   ```bash
   gcloud firestore export gs://[YOUR_BACKUP_BUCKET]/firestore_export_final
   ```
2. **Revoke API Keys & Service Accounts**:
   - In Google Cloud Console -> IAM & Admin -> Service Accounts, disable or delete service accounts used for Firebase Admin SDK.
3. **Decommission Project**:
   - Navigate to Firebase Console -> Project Settings -> Delete Project.
