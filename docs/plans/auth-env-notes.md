# Auth / Login Mode — Environment Notes

Used by the hybrid Login Mode implementation.

| Variable | Where | Purpose |
|---|---|---|
| `JWT_SECRET` | `.env.local` (server) | Required. Signs JWTs for `POST /api/auth/*` and Settings PUT. |
| `LOGIN_MODE` | `.env.local` (server) | Optional. If set to `select`, `password`, or `maintenance`, overrides the DB `login_mode` setting on read. |
| `SUPER_ADMIN_EMAIL` | `.env.local` (server) | Optional. With `SUPER_ADMIN_PASSWORD`, allows password login without a DB hash (user must exist). |
| `SUPER_ADMIN_PASSWORD` | `.env.local` (server) | Optional. Plaintext password for the env login bypass — **dev/ops only; do not use in production.** |
| `VITE_API_URL` | `.env.local` (frontend) | Base URL for API calls (e.g. `http://localhost:3001`). |
| `VITE_PUBLIC_ORG_ID` | `.env.local` (frontend) | Org UUID guests browse on `/`. Unset or unknown → first active org. |

When `login_mode` / `LOGIN_MODE` is `maintenance`, unauthenticated users cannot open the Knowledge Base (whole-site guest lock); they are sent to `/login`.

### Ops helpers

```bash
# Apply schema migrations (app_settings, password_hash, file_blob)
node server/scripts/init-db.js

# Set a user's password for Password (Production) mode testing
node server/scripts/set-password.js user@example.com 'their-password'
```

Admin bypass during maintenance: open `/login?admin=1` to reveal the password form.
