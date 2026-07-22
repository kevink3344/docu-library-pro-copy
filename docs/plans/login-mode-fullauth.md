# Login Mode → Full Auth Path

**Date:** 2026-07-21  
**Status:** Follow-up plan (not yet implemented)  
**Depends on:** Hybrid Login Mode (app_settings, JWT issue on login, bcrypt password path)

---

## Current state (after hybrid)

| Capability | Status |
|---|---|
| `login_mode` / `maintenance_message` in `app_settings` | Done |
| `LOGIN_MODE` env override + `/api/info` | Done |
| `POST /api/auth/login` (select) + `login-with-password` | Done |
| JWT stored in `localStorage` (`kbb_token`) | Done |
| Settings PUT gated by Bearer + `role === 'admin'` | Done |
| JWT required on entity/file/RPC routes | **Not done** |
| Password set/reset UI | **Not done** (CLI script only) |
| Register / Forgot / Reset pages | Stubs |
| Maintenance mode blocks API traffic | **Not done** (UX-only) |

This document is the checklist to close that gap.

---

## Phase A — Protect the API

1. Add Express middleware (reuse `authenticateToken` from `server/lib/auth.js`) on:
   - `/api/:entity` CRUD (except nothing public except health/info/settings GET)
   - `/api/kbb_documents/:id/file` upload/download
   - `/api/rpc/*`
2. Keep public:
   - `GET /api/health`, `GET /api/info`
   - `GET /api/settings/:key`
   - `POST /api/auth/login`, `POST /api/auth/login-with-password`
3. Optional org-scoping: after auth, ensure `org_id` filters match membership (or super-admin).
4. Document visibility: enforce team/`visibility` checks server-side for documents.

**Acceptance:** Unauthenticated `GET /api/User` → `401`. Authenticated non-member cannot read another org’s documents.

---

## Phase B — Session hardening

1. Prefer **httpOnly Secure cookie** for JWT (or dual: cookie + short-lived access token).
2. Shorter access token TTL + refresh token table (or rotate on `/api/auth/refresh`).
3. Logout endpoint that clears cookie / invalidates refresh.
4. Remove legacy `kbb_session_user_id` as a source of truth once cookie/Bearer is mandatory.
5. Fix or delete `src/components/ProtectedRoute.jsx` so it matches `AuthContext`.

---

## Phase C — Password lifecycle UI

1. In **Users** (`MemberManagement`): set/reset password for org members (admin-only).
2. On user create: require temporary password or invite flow; always `bcrypt.hash` server-side.
3. Implement real:
   - `POST /api/auth/register` (if self-signup desired)
   - `POST /api/auth/forgot-password` + email token table
   - `POST /api/auth/reset-password`
4. Wire stub pages `Register.jsx`, `ForgotPassword.jsx`, `ResetPassword.jsx`.
5. Retire `server/scripts/set-password.js` as the primary path (keep as ops emergency tool).

---

## Phase D — Production login posture

1. Default new environments to `login_mode = password` (or force via `LOGIN_MODE=password`).
2. Gate or remove **Select User (Test)** in production builds (`import.meta.env.PROD` or env).
3. Optional: server middleware — if `login_mode === 'maintenance'` (after env override), return `503` for all non-admin authenticated and all unauthenticated API calls except auth password + settings GET + info.
4. Rate-limit `/api/auth/login-with-password` (e.g. express-rate-limit).

---

## Phase E — Cleanup & tests

1. Expand ESLint to `server/` and `src/lib/`.
2. Add Vitest + supertest for:
   - settings GET defaults / env override
   - settings PUT 401/403/200
   - password login success/failure (no user enumeration)
   - entity route 401 without token
3. Update `docs/APPLICATION_GUIDE.md` Auth Phase 4 to match the implemented stack.
4. Add `.env.example` with `JWT_SECRET`, `LOGIN_MODE`, Turso vars (no secrets).

---

## Suggested order

1. Phase A (highest security ROI)  
2. Phase B  
3. Phase C  
4. Phase D  
5. Phase E  

---

## Env vars (target end-state)

| Var | Required | Notes |
|---|---|---|
| `JWT_SECRET` | Yes | Long random secret for signing |
| `LOGIN_MODE` | No | `select` \| `password` \| `maintenance` — overrides DB |
| `TURSO_DATABASE_URL` | Yes | |
| `TURSO_AUTH_TOKEN` | Yes | |
| `CLIENT_URL` | Yes | CORS origin |
| `VITE_API_URL` | Yes (frontend) | API base URL |

---

## Verification checklist (full auth)

1. No token → all entity APIs 401.  
2. Password login → cookie/Bearer works for CRUD.  
3. Select mode disabled or unavailable in production config.  
4. Maintenance + non-admin API → 503; `?admin=1` + password still works for super admin.  
5. Forgot/reset flow changes password; old password fails.  
6. Org-scoped document access cannot be bypassed via direct ID.
