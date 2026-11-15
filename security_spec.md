# AgriShift AI Firestore Security Specification

## 1. Data Invariants
- Every user profile under `/users/{userId}` can only be read by its owner (`request.auth.uid == userId`) or an administrator, and users cannot self-assign `role: "admin"` on creation or elevate their own role on update.
- Every farm under `/farms/{farmId}` must carry an immutable `ownerId` matching `request.auth.uid`, valid geographic coordinates (`latitude` in `[-90, 90]`, `longitude` in `[-180, 180]`), positive `area`, and server-enforced `createdAt == request.time` / `updatedAt == request.time`.
- Every child analytical artifact (`/environmental_assessments/{assessmentId}`, `/rotation_scenarios/{scenarioId}`, `/reports/{reportId}`, `/ai_conversations/{conversationId}`) must reference an existing farm in `/farms/{farmId}` whose `ownerId == request.auth.uid`, ensuring relational consistency and preventing orphaned records.
- Every `allow list` rule evaluates `resource.data.ownerId == request.auth.uid` (or `isAdmin()`) directly without delegating filtering to client queries.
- All document IDs are strictly validated via `isValidId(id)` (`^[a-zA-Z0-9_-]+$`, `<= 128` chars), and all strings/arrays have strict `.size()` bounds.

## 2. Adversarial Payloads ("Dirty Dozen")
1. **Unauthenticated Farm Read**: `get /farms/demo_up` without auth -> `PERMISSION_DENIED`.
2. **Cross-Tenant Farm Read**: User B attempts `get /farms/farm_user_a` -> `PERMISSION_DENIED`.
3. **Blanket List Query Scrape**: User B queries `list /farms` without `where('ownerId', '==', uidB)` -> `PERMISSION_DENIED`.
4. **Admin Role Self-Assignment**: User A creates `/users/uidA` with `{ role: "admin" }` -> `PERMISSION_DENIED`.
5. **Role Escalation Update**: User A updates `/users/uidA` changing `role` from `"farmer"` to `"admin"` -> `PERMISSION_DENIED`.
6. **PII Cross-Read**: User B attempts `get /users/uidA` -> `PERMISSION_DENIED`.
7. **Shadow Ghost Field Injection**: User A creates `/farms/farm1` with an extra `{ isVerifiedByNasa: true }` key -> `PERMISSION_DENIED`.
8. **Ownership Spoofing**: User A creates `/farms/farm1` with `ownerId: "uidB"` -> `PERMISSION_DENIED`.
9. **Immutable Owner Tamper**: User A updates `/farms/farm1` changing `ownerId` -> `PERMISSION_DENIED`.
10. **Orphaned Assessment Creation**: User A creates `/environmental_assessments/a1` pointing to `farmId: "non_existent_farm"` -> `PERMISSION_DENIED`.
11. **Backdated Timestamp Spoofing**: User A creates `/farms/farm1` with `createdAt: "2020-01-01T00:00:00Z"` instead of `request.time` -> `PERMISSION_DENIED`.
12. **ID Poisoning / Resource Exhaustion**: User A attempts `create /farms/aaaa...200chars...` or writes a 5,000-char farm name -> `PERMISSION_DENIED`.
