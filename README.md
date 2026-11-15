# AgriShift AI — Field Shift Decision-Support Platform

**NASA Space Apps Challenge: Adapting Farms with NASA Data**

AgriShift AI is a full-stack agricultural decision-support application helping farmers understand changing environmental conditions and explore scientifically informed, explainable crop rotation strategies.

---

## Architecture & Migration Highlights

AgriShift AI has been fully upgraded from Firebase/Firestore to an enterprise-grade relational architecture:
- **Authentication**: Native JWT-based Email/Password authentication as the primary system with bcrypt password hashing (12 salt rounds), short-lived access tokens (15m) kept strictly in-memory, rotating 7-day refresh tokens stored as SHA-256 hashes in PostgreSQL and sent via `HttpOnly`, `SameSite=Lax`, `Secure` cookies, token reuse detection, and device revocation.
- **Secondary Google OAuth 2.0**: Optional Google Sign-In with server-side token verification (`google-auth-library`) and safe account linking that prevents account takeovers by rejecting unverified Google emails.
- **Relational Database**: PostgreSQL with Prisma ORM featuring 17 normalized tables with UUID primary keys, foreign key constraints, cascading deletions, composite unique constraints, and B-tree indexes for ownership, coordinates, and chronological analytics.
- **User Isolation**: Transactional repositories strictly enforce user boundary isolation; farmers can never access, edit, or delete another user's parcels, assessments, scenarios, or reports.
- **Zero In-Memory Volatility**: All farms, soil profiles, crop histories, environmental assessments, rotation scenarios, AI assistant conversations, and reports persist in PostgreSQL.
- **Zero Firebase Dependency**: All Firebase SDK dependencies, Firestore rules, and client libraries have been replaced.

---

## Database Schema (17 Tables)

1. `users` — Farmer accounts, bcrypt password hashes, verification flags, and profile fields.
2. `oauth_accounts` — Google OAuth accounts safely linked via `provider` and `providerAccountId`.
3. `refresh_tokens` — SHA-256 hashed rotating refresh tokens with expiration and revocation tracking.
4. `password_reset_tokens` — SHA-256 hashed one-time password reset tokens (1-hour lifespan).
5. `farms` — Agricultural parcels with coordinates, location accuracy, address components, boundary GeoJSON, irrigation, and water availability.
6. `soil_profiles` — Soil chemistry (pH, N, P, K, organic carbon, organic matter, texture, drainage).
7. `crop_history` — Seasonal sowing, harvest, and historical yield notes per parcel.
8. `environmental_observations` — Time-series agro-meteorological metrics (NASA POWER, satellite observations).
9. `environmental_assessments` — Environmental risk snapshots, pillar risk levels, scores, and methodology metadata.
10. `crop_knowledge` — 17 ICAR/FAO agronomic profiles, growing limits, and ecological metadata.
11. `farmer_preferences` — Weight priorities for water, soil, climate resilience, market, and erosion.
12. `rotation_scenarios` — Generated rotation plans, multi-season crop sequences, and total scores.
13. `ai_conversations` — Gemini AI conversation sessions tied to user parcels.
14. `ai_messages` — Full transcript turns (`user` and `assistant`) with chronological ordering.
15. `reports` — Generated decision-support PDF reports and metadata summaries.
16. `notifications` — Farm advisory notifications and system alerts.
17. `audit_logs` — Audited user actions, resource types, and security events.

---

## Local Development & Setup

### Prerequisites
- Node.js (v20+)
- PostgreSQL (v14+) running locally or accessible via network

### 1. Environment Configuration
Copy the template and configure your secrets:
```bash
cp .env.example .env
```
Ensure `DATABASE_URL`, `JWT_ACCESS_SECRET`, and `JWT_REFRESH_SECRET` are set. For example:
```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/agrishift_db"
JWT_ACCESS_SECRET="generate_a_secure_random_64_character_hex_string"
JWT_REFRESH_SECRET="generate_a_secure_random_64_character_hex_string"
```

### 2. Database Migrations & Seeding
```bash
# Generate Prisma Client
npx prisma generate

# Apply migrations to PostgreSQL
npm run db:migrate

# Seed 17 ICAR/FAO crop knowledge profiles & demo parcel
npm run db:seed
```

### 3. Run Quality Gates & Tests
```bash
# Run TypeScript compilation check
npm run lint

# Run end-to-end automated test suite (29 tests)
npm run test

# Run Vite frontend production build
npm run build
```

### 4. Start Development Server
```bash
npm run dev
```
The server will start at `http://localhost:3000` serving both the Express API and Vite React frontend.

---

## Optional PostGIS Spatial Extension

By default, AgriShift AI stores validated Polygon/MultiPolygon boundaries in indexed PostgreSQL `JSONB` columns with indexed `latitude` and `longitude` numeric fields for maximum portability.

To enable native PostGIS geometric indexing and spatial operations:
1. Ensure the PostGIS extension is installed on your PostgreSQL server:
   ```sql
   CREATE EXTENSION IF NOT EXISTS postgis;
   ```
2. In `prisma/schema.prisma`, enable the `postgresqlExtensions` preview feature and update the `farms` table with `Unsupported("geometry(Polygon, 4326)")`.

---

## Retiring Old Firebase Resources (Safe Decommissioning)

Since the active application has been completely decoupled from Firebase, follow these manual steps to retire old remote resources:
1. **Verify Local Data**: Ensure your PostgreSQL database contains all necessary seed profiles and historical data.
2. **Export Remote Firestore Data** (if needed for archiving):
   ```bash
   gcloud firestore export gs://YOUR_BACKUP_BUCKET/firestore-final-backup
   ```
3. **Disable Remote Firebase Auth**: In Google Cloud Console / Firebase Console, navigate to **Authentication** -> **Sign-in method** and disable Email and Google providers.
4. **Delete Remote Firestore Database / Firebase Project**: When no longer required, delete the project from the Google Cloud Console.

---

## Environment Variables Reference

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string (`postgresql://user:pass@host:5432/db`) |
| `JWT_ACCESS_SECRET` | Yes | Secret key for signing 15-minute JWT access tokens |
| `JWT_REFRESH_SECRET` | Yes | Secret key for signing 7-day JWT refresh tokens |
| `GOOGLE_CLIENT_ID` | Optional | Google OAuth 2.0 Web Client ID |
| `GOOGLE_CLIENT_SECRET` | Optional | Google OAuth 2.0 Web Client Secret |
| `GOOGLE_CALLBACK_URL` | Optional | OAuth redirect URI (e.g., `http://localhost:3000/api/auth/google/callback`) |
| `GEMINI_API_KEY` | Optional | Google Gemini API key for AI assistant features |
| `APP_URL` | Optional | Public application URL (default: `http://localhost:3000`) |
| `CORS_ORIGIN` | Optional | Allowed CORS origins in production |
| `NODE_ENV` | Optional | Environment mode (`development` or `production`) |
