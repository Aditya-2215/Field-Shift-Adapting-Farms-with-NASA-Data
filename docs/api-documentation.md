# AgriShift AI REST API Reference

Base URL: `/api`

## Authentication & Authorization Model
- **Primary Authentication**: Email and password authentication with Argon2id/bcrypt (12 rounds) password hashing.
- **Token Verification**: 
  - Access Token: Short-lived (15 minutes) signed JWT (`HS256`) delivered via `Authorization: Bearer <token>` header.
  - Refresh Token: Rotating 7-day token hashed (SHA-256) in PostgreSQL and transported via `HttpOnly`, `SameSite=Lax`, `Secure` (in production) cookies.
  - Automatic Reuse Detection: Attempting to use an already-revoked refresh token revokes all active session tokens for the user account.
- **Secondary Google OAuth 2.0**: Optional Google login verifying Google ID tokens server-side via `google-auth-library`. Only links to existing email accounts if Google reports `email_verified: true`, preventing account takeover. Issues standard application JWT access/refresh tokens.
- **Read-Only Demonstration Mode**: Requests without authorization tokens run in demo mode (`isDemo: true`) and may inspect the built-in `demo_up_barabanki_01` parcel and run non-destructive analyses. Mutations on persistent resources return `401 Unauthorized`.
- **Ownership & Isolation**: All user-owned data in PostgreSQL is filtered by `userId === authUser.uid`. Users cannot read, modify, or delete another user's farms, soil profiles, assessments, scenarios, conversations, or reports.

---

## Endpoints

### 1. Authentication (`/api/auth`)
- `POST /api/auth/register` — Register new user with full name, email, password, and confirm password.
- `POST /api/auth/login` — Sign in with email, password, and optional `rememberMe`. Issues access token in response and HttpOnly refresh cookie.
- `POST /api/auth/refresh` — Rotate refresh token from HttpOnly cookie and issue fresh 15-minute access token.
- `POST /api/auth/logout` — Revoke current refresh token and clear cookie.
- `POST /api/auth/logout-all` *(Auth required)* — Revoke all refresh tokens for the user across all devices.
- `GET /api/auth/me` *(Auth required)* — Retrieve authenticated user details (`uid`, `email`, `name`, `role`, `emailVerified`).
- `POST /api/auth/forgot-password` — Generate secure, one-time password reset token (1-hour expiration).
- `POST /api/auth/reset-password` — Reset password using valid one-time reset token.
- `POST /api/auth/change-password` *(Auth required)* — Change password with current password verification.
- `GET /api/auth/google` — Redirect to Google OAuth consent screen.
- `GET /api/auth/google/callback` — Handle Google OAuth redirect code.
- `POST /api/auth/google/verify` — Exchange Google ID token for application JWT tokens.
- `GET /api/auth/profile` *(Auth required)* — Retrieve user profile.
- `PUT /api/auth/profile` *(Auth required)* — Update user profile details (`name`, `preferredLanguage`, `location`).

### 2. System & Health
- `GET /api/health` — Server health status, PostgreSQL database connection, JWT configuration, and Gemini AI status.

### 3. Farms & Geospatial Mapping
- `GET /api/farms` — Lists user-owned PostgreSQL farms plus read-only `demo_up_barabanki_01`.
- `GET /api/farms/:id` — Returns owned farm or read-only demo farm (`403` if owned by another user).
- `POST /api/farms` *(Auth required)* — Creates a persistent farm record in PostgreSQL with foreign keys and transactionally initializes soil profile.
- `PUT /api/farms/:id` *(Auth + owner required)* — Updates owned farm attributes, coordinates, and boundary GeoJSON.
- `PATCH /api/farms/:id/location` *(Auth + owner required)* — Updates latitude, longitude, location accuracy, address components, and administrative hierarchy.
- `PATCH /api/farms/:id/boundary` *(Auth + owner required)* — Updates boundary GeoJSON polygon and calculated area in hectares.
- `DELETE /api/farms/:id` *(Auth + owner required)* — Cascading delete removes farm, soil profiles, crop history, assessments, scenarios, and reports.
- `GET /api/farms/:id/soil-profile` — Reads soil profile for owned or demo farm.
- `PUT /api/farms/:id/soil-profile` *(Auth + owner required)* — Updates soil profile fields (`ph`, NPK, organic carbon, drainage, notes).
- `GET /api/geospatial/geocode?q=` — Searches address for villages, districts, states, and coordinates with caching, rate limiting, and Indian agricultural region fallback.
- `GET /api/geospatial/reverse-geocode?lat=&lon=` — Resolves coordinates to village, district, state, country, and formatted address.
- `GET /api/geospatial/elevation?lat=&lon=` — Retrieves SRTM DEM elevation baseline in meters ASL with 30m spatial resolution.
- `POST /api/geospatial/analyze-geojson` — Validates Polygon/MultiPolygon GeoJSON using Turf.js and computes area (`hectares`, `acres`), centroid, and normalized Feature.

### 4. NASA Earth Observation
- `GET /api/nasa/power?lat=&lon=&farmId=&startDate=&endDate=` — Retrieves live NASA POWER daily observations (`T2M`, `T2M_MAX`, `T2M_MIN`, `PRECTOTCORR`, `RH2M`, `ALLSKY_SFC_SW_DWN`) and 25-year climatology anomalies over a rolling 12-month window.
- `GET /api/nasa/datasets/status` — Returns status (`Connected`, `Authentication required`, `Not configured`, or `Pipeline unavailable`) and resolution metadata for 8 NASA datasets.
- `GET /api/nasa/precipitation?lat=&lon=&farmId=` — Monthly and seasonal precipitation summary derived from NASA POWER `PRECTOTCORR`.
- `GET /api/nasa/temperature?lat=&lon=&farmId=` — Monthly temperature envelope and climatology anomalies derived from NASA POWER `T2M`.
- `GET /api/nasa/soil-moisture` — Reports SMAP L3/L4 availability.
- `GET /api/nasa/vegetation` — Reports MODIS/Landsat NDVI raster availability.

### 5. Environmental Risk, Crops, Rotations & Simulator
- `POST /api/analysis/environment` — Runs the Environmental Intelligence Engine (`Thermal`, `Precipitation`, `Water Balance`, `Soil Vulnerability`); accepts `{ farmId, persist?: boolean }`.
- `GET /api/assessments?farmId=` *(Auth required)* — Lists persisted assessment snapshots in PostgreSQL.
- `POST /api/assessments` *(Auth + owner required)* — Computes and saves a risk snapshot in PostgreSQL.
- `DELETE /api/assessments/:id` *(Auth + owner required)* — Deletes a saved assessment snapshot.
- `GET /api/crops`, `GET /api/crops/:id` — Static and PostgreSQL-backed ICAR/FAO agronomic knowledge base (17 crops).
- `POST /api/crops/suitability` — Deterministic 0–100 crop suitability matrix for an authorized farm.
- `POST /api/rotation/generate` — Generates and scores Strategy A (Baseline) through Strategy D given farmer priority weights.
- `GET /api/rotations?farmId=` *(Auth required)* — Lists saved rotation scenarios in PostgreSQL.
- `POST /api/rotations` *(Auth + owner required)* — Persists `{ farmId, title, weights }` to PostgreSQL.
- `DELETE /api/rotations/:id` *(Auth + owner required)* — Deletes a saved rotation scenario.
- `POST /api/simulator/run` — Non-destructive What-If climate/water assumption simulation.

### 6. AI Assistant & Decision Reports
- `GET /api/ai/conversations?farmId=` *(Auth + owner required)* — Loads persisted AI chat history from PostgreSQL for an owned parcel.
- `POST /api/ai/chat` — Server-side Gemini (`gemini-4-hydrogen`) assistant grounded in farm, NASA POWER, suitability, and rotation context. Appends turns to PostgreSQL `ai_messages` when authenticated.
- `GET /api/reports?farmId=`, `GET /api/reports/:id`, `DELETE /api/reports/:id` *(Auth + owner required)* — Manage archived decision reports in PostgreSQL.
- `POST /api/reports/generate` — Generates complete decision report payload and archives summary metadata to PostgreSQL `reports`.
