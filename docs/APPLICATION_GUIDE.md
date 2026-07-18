# Base44 → VS Code Migration Guide

A repeatable playbook for taking a Base44 project off the platform and running it
locally (VS Code + Vite + React) against a **Turso SQLite** database with custom
Turso-based auth.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Prerequisites](#2-prerequisites)
3. [Phase 1 — Get the Code](#3-phase-1--get-the-code)
4. [Phase 2 — Turso Database Setup](#4-phase-2--turso-database-setup)
5. [Phase 3 — Wire Up the Client Layer](#5-phase-3--wire-up-the-client-layer)
6. [Phase 4 — Replace Auth](#6-phase-4--replace-auth)
7. [Phase 5 — Replace Entity API Calls](#7-phase-5--replace-entity-api-calls)
8. [Phase 6 — Replace File Attachments](#8-phase-6--replace-file-attachments)
9. [Phase 7 — Replace Base44 Functions](#9-phase-7--replace-base44-functions)
10. [Phase 8 — Clean Up & Validate](#10-phase-8--clean-up--validate)
11. [Reference Patterns](#11-reference-patterns)
12. [Decision Log](#12-decision-log)

---

## 1. Overview

Base44 provides four backend services that need replacing:

| Base44 Service | Replacement |
|---|---|
| `base44.auth.*` | Custom JWT / bcrypt stored in Turso `users` table |
| `base44.entities.*` | `db.js` CRUD layer over `@libsql/client/web` |
| `base44.integrations.Core.UploadFile` | SQLite BLOB column **or** Google Drive API |
| `base44.functions.invoke(name, args)` | Cloudflare Worker or inline `fetch()` |

All data lives in Turso (SQLite). No Supabase, no Firebase, no external auth service.

---

## 2. Prerequisites

### Tools
- Node.js ≥ 18 — required for `crypto.randomUUID()` and `@libsql/client`
- [Turso CLI](https://docs.turso.tech/cli/introduction)
  - macOS/Linux: `brew install tursodatabase/tap/turso`
  - Windows: `winget install turso` or `scoop install turso`
- VS Code + GitHub Copilot (for the migration itself)
- Git

### Accounts
- [Turso](https://turso.tech) — free tier covers most apps (500 MB, 1 DB)
- GitHub — to pull Base44-exported code
- Google Cloud (optional) — for Drive attachment storage

### VS Code Extensions (recommended)
- **ESLint** / **Prettier** — already configured in most Base44 exports
- **SQLite Viewer** — inspect your Turso database locally via `.db` file

---

## 3. Phase 1 — Get the Code

### 3a. Download from Base44

Option A — GitHub integration (preferred):
1. In Base44 → **Project Settings → GitHub → Connect** to link the repo.
2. `git clone https://github.com/your-org/your-project.git`

Option B — Direct download:
1. Base44 → **Project Settings → Export → Download ZIP**.
2. Unzip and open the folder in VS Code.

Then:
```bash
npm install        # installs @base44/sdk and everything else
npm run dev        # confirm the dev server starts (it will show 404s — that's OK)
```

### 3b. Inventory the Base44 Surface

Before touching any code, map out every Base44 integration in the project:

```bash
# Find all files that reference base44
grep -r "base44" src --include="*.jsx" --include="*.tsx" --include="*.js" -l

# Count call sites by category
grep -r "base44\.auth\."        src --include="*.jsx" --include="*.js" -n
grep -r "base44\.entities\."    src --include="*.jsx" --include="*.js" -n
grep -r "base44\.integrations\." src --include="*.jsx" --include="*.js" -n
grep -r "base44\.functions\."   src --include="*.jsx" --include="*.js" -n
grep -r "\.subscribe("          src --include="*.jsx" --include="*.js" -n
```

Categorise what you find into:

| Category | Base44 API | Work Required |
|---|---|---|
| Auth | `base44.auth.*` | Phase 4 |
| Data entities | `base44.entities.X.*` | Phase 5 |
| File upload | `base44.integrations.Core.UploadFile` | Phase 6 |
| Server functions | `base44.functions.invoke(name, args)` | Phase 7 |
| Real-time | `base44.entities.X.subscribe(cb)` | Remove / replace with polling |

Keep this inventory open while you work. It is your completion checklist.

### 3c. Create `.env`

```env
VITE_TURSO_DB_URL=libsql://your-db-name.turso.io
VITE_TURSO_TOKEN=your-token-here

# Optional — only needed when you add Google Drive attachment storage
VITE_GOOGLE_CLIENT_ID=
```

Confirm `.env` is in `.gitignore` — it almost certainly already is in a Base44
export, but double-check.

---

## 4. Phase 2 — Turso Database Setup

### 4a. Create the Database

```bash
turso auth login
turso db create your-app-name
turso db show your-app-name           # copy the libsql:// URL
turso db tokens create your-app-name  # copy the auth token
```

Paste both values into `.env`.

### 4b. Translate Base44 Entities to a SQLite Schema

Base44 entity definitions live in `base44/entities/*.jsonc`. Each entity becomes
a table. Use these translation rules:

| Base44 field type | SQLite column definition |
|---|---|
| `string` | `TEXT` |
| `number` | `REAL` |
| `boolean` | `INTEGER NOT NULL DEFAULT 0` (0 = false, 1 = true) |
| `date` | `TEXT` (store as ISO-8601: `YYYY-MM-DDTHH:MM:SS.sssZ`) |
| `array` of strings/objects | `TEXT NOT NULL DEFAULT '[]'` (JSON string) |
| `object` | `TEXT NOT NULL DEFAULT '{}'` (JSON string) |
| `enum` | `TEXT CHECK (col IN ('a', 'b', 'c'))` |
| `file_url` | `TEXT` (store a URL or Drive link) |

Every entity automatically gets these columns from Base44 — always include them:

```sql
id            TEXT PRIMARY KEY NOT NULL,
created_date  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
updated_date  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
created_by_id TEXT
```

See `supabase/migrations/schema.sql` in this project for a complete worked example.

### 4c. Apply the Schema

```bash
# Apply from a .sql file
turso db shell your-app-name < supabase/migrations/schema.sql

# Or interactively
turso db shell your-app-name
> CREATE TABLE IF NOT EXISTS users ( ... );
```

### 4d. Export Existing Base44 Data (optional)

If you have production data in Base44 to migrate:

1. Export as JSON from Base44 admin panel (Settings → Data Export).
2. Write a one-time import script:

```js
// scripts/import.mjs  — run with: node scripts/import.mjs
import { createClient } from '@libsql/client';
import data from './export.json' assert { type: 'json' };

const turso = createClient({
  url:       process.env.TURSO_DB_URL,
  authToken: process.env.TURSO_TOKEN,
});

for (const org of data.organizations) {
  await turso.execute({
    sql:  `INSERT OR IGNORE INTO organizations (id, name, description, is_active)
           VALUES (:id, :name, :desc, 1)`,
    args: { id: org.id, name: org.name, desc: org.description ?? '' },
  });
}
console.log('Import complete');
```

---

## 5. Phase 3 — Wire Up the Client Layer

### 5a. Install Packages

```bash
npm install @libsql/client
```

You can uninstall the Base44 SDK **after** the migration is complete:
```bash
npm uninstall @base44/sdk @base44/vite-plugin
```

### 5b. Create `src/api/tursoClient.js`

```js
import { createClient } from '@libsql/client/web';
//                                              ^^^^
// CRITICAL: use the /web subpath — this is the browser-compatible build.
// The default '@libsql/client' entry point targets Node.js and will fail in Vite.

export const turso = createClient({
  url:       import.meta.env.VITE_TURSO_DB_URL,
  authToken: import.meta.env.VITE_TURSO_TOKEN,
});
```

### 5c. Create `src/api/db.js` — Generic CRUD Factory

This is the core replacement for `base44.entities`. Build a factory that mirrors
the Base44 entity API (`filter`, `list`, `get`, `create`, `update`, `delete`) so
call-site changes are mechanical find-and-replace operations.

```js
import { turso } from './tursoClient';

const uuid = () => crypto.randomUUID();
const now  = () => new Date().toISOString();

// ── JSON columns ──────────────────────────────────────────────────────────────
// List every column that is stored as a JSON string in SQLite.
// The factory will JSON.parse on read and JSON.stringify on write automatically.
const JSON_FIELDS = {
  organizations: ['admin_user_ids'],
  kbb_documents: ['tags', 'location', 'department', 'allowed_team_ids', 'custom_field_values'],
  custom_fields: ['options'],
  field_configs: ['hidden_required_fields', 'add_screen_order', 'view_screen_order', 'dashboard_columns'],
  teams:         ['member_user_ids'],
};

// ── Boolean columns ───────────────────────────────────────────────────────────
// SQLite stores booleans as integers (0/1). Declare them here so the factory
// converts them to real JS booleans on read.
const BOOL_FIELDS = {
  organizations: ['is_active'],
  locations:     ['is_active', 'pinned'],
  departments:   ['is_active', 'pinned'],
  kbb_documents: ['renew_notified_30', 'renew_notified_7', 'is_archived'],
  notifications: ['is_read'],
};

function parseRow(table, row) {
  if (!row) return null;
  const obj = { ...row };
  for (const f of (JSON_FIELDS[table] || [])) {
    if (obj[f] != null) { try { obj[f] = JSON.parse(obj[f]); } catch { obj[f] = []; } }
  }
  for (const f of (BOOL_FIELDS[table] || [])) {
    if (obj[f] !== undefined) obj[f] = obj[f] === 1 || obj[f] === true;
  }
  return obj;
}

function serializeRow(table, data) {
  const obj = { ...data };
  for (const f of (JSON_FIELDS[table] || [])) {
    if (obj[f] !== undefined) obj[f] = typeof obj[f] === 'string' ? obj[f] : JSON.stringify(obj[f]);
  }
  return obj;
}

function buildWhere(filters) {
  const entries = Object.entries(filters).filter(([, v]) => v !== undefined);
  if (!entries.length) return { clause: '', args: {} };
  return {
    clause: 'WHERE ' + entries.map(([k]) => `${k} = :${k}`).join(' AND '),
    args:   Object.fromEntries(entries),
  };
}

function makeEntity(table) {
  return {
    async list() {
      const rs = await turso.execute(`SELECT * FROM ${table}`);
      return rs.rows.map(r => parseRow(table, r));
    },
    async filter(where = {}, sort = null, limit = null) {
      const { clause, args } = buildWhere(where);
      let sql = `SELECT * FROM ${table} ${clause}`;
      if (sort) { const d = sort.startsWith('-'); sql += ` ORDER BY ${d ? sort.slice(1) : sort} ${d ? 'DESC' : 'ASC'}`; }
      if (limit) sql += ` LIMIT ${Number(limit)}`;
      const rs = await turso.execute({ sql, args });
      return rs.rows.map(r => parseRow(table, r));
    },
    async get(id) {
      const rs = await turso.execute({ sql: `SELECT * FROM ${table} WHERE id = :id`, args: { id } });
      return parseRow(table, rs.rows[0] ?? null);
    },
    async create(data) {
      const id = data.id || uuid();
      const d  = serializeRow(table, { ...data, id, created_date: data.created_date || now(), updated_date: now() });
      const keys = Object.keys(d);
      await turso.execute({ sql: `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${keys.map(k => ':' + k).join(', ')})`, args: d });
      return this.get(id);
    },
    async update(id, data) {
      const d = serializeRow(table, { ...data, updated_date: now() });
      delete d.id; delete d.created_date;
      if (!Object.keys(d).length) return this.get(id);
      const sets = Object.keys(d).map(k => `${k} = :${k}`).join(', ');
      await turso.execute({ sql: `UPDATE ${table} SET ${sets} WHERE id = :id`, args: { ...d, id } });
      return this.get(id);
    },
    async delete(id) {
      await turso.execute({ sql: `DELETE FROM ${table} WHERE id = :id`, args: { id } });
    },
  };
}

// ── Entity exports ─────────────────────────────────────────────────────────────
// Add one entry per Base44 entity, matching the name used in the app.
export const db = {
  Organization: makeEntity('organizations'),
  Location:     makeEntity('locations'),
  Department:   makeEntity('departments'),
  KBBDocument:  makeEntity('kbb_documents'),
  CustomField:  makeEntity('custom_fields'),
  FieldConfig:  makeEntity('field_configs'),
  Team:         makeEntity('teams'),
  OrgMember:    makeEntity('org_members'),
  Notification: makeEntity('notifications'),
  User:         makeEntity('users'),
};
```

---

## 6. Phase 4 — Replace Auth

### 6a. The `users` Table

Your Turso `users` table is the source of truth. Minimum columns:

```sql
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY NOT NULL,
  full_name     TEXT,
  email         TEXT UNIQUE,
  password_hash TEXT,            -- bcrypt hash; NULL for SSO-only users
  role          TEXT NOT NULL DEFAULT 'user',  -- 'user' | 'admin'
  created_date  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_date  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
```

### 6b. Dev Auto-Login — Phase 1 (Testing)

For initial testing, skip passwords entirely. Present a UI that lets you pick an
organization and user from the database and stores the chosen user ID in
`localStorage`. This is what is currently live in this project.

```js
// src/lib/AuthContext.jsx  (dev session)
const SESSION_KEY = 'kbb_session_user_id';

const login = async (userId) => {
  const u = await db.User.get(userId);
  if (!u) throw new Error('User not found');
  localStorage.setItem(SESSION_KEY, userId);
  setUser(u); setIsAuthenticated(true);
};

const logout = () => {
  localStorage.removeItem(SESSION_KEY);
  setUser(null); setIsAuthenticated(false);
};

// On mount — restore session from localStorage
useEffect(() => {
  const stored = localStorage.getItem(SESSION_KEY);
  if (!stored) { setIsLoadingAuth(false); return; }
  db.User.get(stored).then(u => {
    if (u) { setUser(u); setIsAuthenticated(true); }
  }).finally(() => setIsLoadingAuth(false));
}, []);
```

The Login page (`src/pages/Login.jsx`) uses `db.Organization.list()` and
`db.User.list()` to populate the dropdowns, and shows live org-level stats
(teams, documents, locations) for the selected org.

### 6c. Production Auth — Phase 2 (Real Passwords)

Turso is a database — password hashing (`bcrypt`) **must happen server-side**.
You need a lightweight backend. Choose one of the options below.

The **client-side login call** is identical regardless of which backend you pick:

```js
const login = async (email, password) => {
  const res = await fetch('/api/auth/login', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error((await res.json()).error);
  const { token } = await res.json();
  localStorage.setItem('kbb_token', token);
  const payload = JSON.parse(atob(token.split('.')[1]));
  setUser(payload); setIsAuthenticated(true);
};
```

Endpoints every backend must implement:

| Endpoint | Logic |
|---|---|
| `POST /api/auth/register` | Check email unique → `bcrypt.hash(pw, 12)` → INSERT → return JWT |
| `POST /api/auth/login` | Fetch user by email → `bcrypt.compare` → return JWT |
| `POST /api/auth/forgot-password` | Generate token → store in DB → email link (Resend or Mailgun) |
| `GET  /api/auth/google` | Start Google OAuth flow |
| `GET  /api/auth/google/callback` | Exchange code → upsert user in Turso → return JWT |

#### Option A — Cloudflare Workers

Free tier: 100k requests/day. Zero cold-start. Deploys in ~30 seconds.

```bash
npm create cloudflare@latest auth-worker
cd auth-worker
npm install bcryptjs @libsql/client jose
wrangler deploy
```

Vite dev proxy:
```js
// vite.config.js
server: { proxy: { '/api': 'https://auth-worker.your-subdomain.workers.dev' } }
```

#### Option B — Azure Functions

Free tier: 1 million executions/month. Best choice if you are already in the
Microsoft / Azure ecosystem or want first-class VS Code tooling.

**Prerequisites**:
- Azure subscription (free tier works)
- [Azure Functions Core Tools v4](https://learn.microsoft.com/en-us/azure/azure-functions/functions-run-local):
  `npm install -g azure-functions-core-tools@4`
- VS Code **Azure Functions** extension (provides local run, deploy, and logs)

**Scaffold the functions project**:

```bash
# In your repo root (or a separate sub-folder)
func init api --worker-runtime node --language typescript
cd api
npm install bcryptjs @libsql/client jose @azure/functions

# Create an HTTP trigger for each endpoint
func new --name authLogin    --template "HTTP trigger"
func new --name authRegister --template "HTTP trigger"
func new --name renewalNotifications --template "Timer trigger"
```

**Example login function** (`api/src/functions/authLogin.ts`):

```ts
import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { createClient } from '@libsql/client';
import * as bcrypt from 'bcryptjs';
import * as jose from 'jose';

app.http('authLogin', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'auth/login',
  handler: async (req: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> => {
    const { email, password } = await req.json() as any;
    const turso = createClient({
      url:       process.env.TURSO_DB_URL!,
      authToken: process.env.TURSO_TOKEN!,
    });
    const rs   = await turso.execute({ sql: 'SELECT * FROM users WHERE email = :email', args: { email } });
    const user = rs.rows[0];
    if (!user || !await bcrypt.compare(password, user.password_hash as string)) {
      return { status: 401, jsonBody: { error: 'Invalid credentials' } };
    }
    const token = await new jose.SignJWT({ id: user.id, role: user.role })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('7d')
      .sign(new TextEncoder().encode(process.env.JWT_SECRET!));
    return { jsonBody: { token } };
  },
});
```

**Example scheduled function** (`api/src/functions/renewalNotifications.ts`):

```ts
import { app, Timer, InvocationContext } from '@azure/functions';

app.timer('renewalNotifications', {
  schedule: '0 0 9 * * *',   // daily at 9:00 AM UTC
  handler: async (timer: Timer, ctx: InvocationContext) => {
    // query Turso for expiring documents, write notifications rows, send emails
  },
});
```

**Secrets** — store in `api/local.settings.json` for local dev (already in `.gitignore`);
in production set them as **Application Settings** in the Azure portal:

```json
{
  "IsEncrypted": false,
  "Values": {
    "TURSO_DB_URL":  "libsql://...",
    "TURSO_TOKEN":   "...",
    "JWT_SECRET":    "..."
  }
}
```

**Run locally**:

```bash
cd api && func start   # starts on http://localhost:7071
```

Vite dev proxy:

```js
// vite.config.js
server: { proxy: { '/api': 'http://localhost:7071/api' } }
```

**Deploy**:

```bash
# Via VS Code: Azure extension → Function App → Deploy to Function App
# Or via CLI:
func azure functionapp publish <your-function-app-name>
```

### 6d. Auth Call-Site Replacement Table

| Base44 call | Replacement |
|---|---|
| `base44.auth.me()` | `db.User.get(localStorage.getItem(SESSION_KEY))` |
| `base44.auth.loginViaEmailPassword(e, p)` | `POST /api/auth/login` |
| `base44.auth.register({ email, password })` | `POST /api/auth/register` |
| `base44.auth.logout()` | `localStorage.removeItem(SESSION_KEY)` |
| `base44.auth.resetPasswordRequest(email)` | `POST /api/auth/forgot-password` |
| `base44.auth.resetPassword({ resetToken, newPassword })` | `POST /api/auth/reset-password` |
| `base44.auth.loginWithProvider('google', '/')` | `window.location.href = '/api/auth/google'` |
| `base44.auth.verifyOtp({ email, otpCode })` | `POST /api/auth/verify-otp` |

---

## 7. Phase 5 — Replace Entity API Calls

This is the bulk of the migration work, but it is purely mechanical once `db.js`
exists.

### The Pattern

```
base44.entities.EntityName  →  db.EntityName
```

```js
// Before
import { base44 } from '@/api/base44Client';
const docs = await base44.entities.KBBDocument.filter({ org_id: x }, '-created_date', 50);

// After
import { db } from '@/api/db';
const docs = await db.KBBDocument.filter({ org_id: x }, '-created_date', 50);
```

### Full Call-Site Replacement Table

| Base44 | `db.js` replacement |
|---|---|
| `base44.entities.Foo.list()` | `db.Foo.list()` |
| `base44.entities.Foo.filter(where, sort, limit)` | `db.Foo.filter(where, sort, limit)` |
| `base44.entities.Foo.get(id)` | `db.Foo.get(id)` |
| `base44.entities.Foo.create(data)` | `db.Foo.create(data)` |
| `base44.entities.Foo.update(id, patch)` | `db.Foo.update(id, patch)` |
| `base44.entities.Foo.delete(id)` | `db.Foo.delete(id)` |
| `base44.entities.Foo.subscribe(cb)` | **Remove** — poll on `useEffect` mount, or use Turso webhooks |

### JSON / Boolean Gotchas

Base44 stores arrays and booleans as native JavaScript types. SQLite stores them
as JSON strings and integers (0/1). The `db.js` factory handles this
transparently via the `JSON_FIELDS` and `BOOL_FIELDS` maps — but you **must**
declare every such column in those maps for the table you are working with, or
you will get raw strings/integers instead of arrays/booleans in your components.

### Removing Real-Time Subscriptions

Base44 offered WebSocket-based subscriptions (`entity.subscribe(cb)`). Turso has
no built-in push. The options:

- **Simplest**: Remove the subscription entirely. Data refreshes on component
  mount. Acceptable for most apps.
- **Polling**: Add a `setInterval` inside `useEffect` to re-fetch every N seconds.
- **Turso Webhooks** (advanced): Configure a webhook in Turso → POST to your
  Cloudflare Worker → use Server-Sent Events to push to the browser.

---

## 8. Phase 6 — Replace File Attachments

Base44 provided `base44.integrations.Core.UploadFile` (returns a private URI) and
`base44.integrations.Core.CreateFileSignedUrl` (returns a temporary public URL).
Both are replaced in this project. Choose one storage backend:

### Option A — SQLite BLOB (simple, no external service)

Best for: files < 10 MB, internal tools, no CDN needed.

Add columns to your document table:

```sql
ALTER TABLE kbb_documents ADD COLUMN file_data BLOB;
ALTER TABLE kbb_documents ADD COLUMN file_name TEXT;
ALTER TABLE kbb_documents ADD COLUMN file_mime TEXT;
```

Upload and preview:

```js
// Store as BLOB via turso
const buf = await file.arrayBuffer();
await db.KBBDocument.update(id, {
  file_data: new Uint8Array(buf),
  file_name: file.name,
  file_mime: file.type,
});

// Create an object URL for inline preview
const doc  = await db.KBBDocument.get(id);
const blob = new Blob([doc.file_data], { type: doc.file_mime });
const url  = URL.createObjectURL(blob);   // pass to <iframe> or <a>
```

> **Turso storage note**: The free tier provides 500 MB total. BLOBs grow fast —
> plan accordingly and consider Option B for anything beyond internal documents.

### Option B — Google Drive (recommended for larger files)

Best for: documents of any size, organizations already using Google Workspace.

**Setup**:
1. [Google Cloud Console](https://console.cloud.google.com) → New project → enable **Drive API**.
2. **Credentials → Create OAuth 2.0 Client ID** (Web application).
3. Add your `localhost:5173` and production URL to Authorized JavaScript Origins.
4. Add `VITE_GOOGLE_CLIENT_ID=your-client-id` to `.env`.

**Upload from the browser** (using the [Google Identity Services](https://developers.google.com/identity/oauth2/web/guides/use-code-model) library):

```js
// 1. Get an access token via GIS (add the script tag to index.html)
const tokenClient = google.accounts.oauth2.initTokenClient({
  client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
  scope:     'https://www.googleapis.com/auth/drive.file',
  callback:  (response) => uploadToDrive(file, response.access_token),
});
tokenClient.requestAccessToken();

// 2. Upload via multipart Drive API
const uploadToDrive = async (file, accessToken) => {
  const meta = { name: file.name, mimeType: file.type };
  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(meta)], { type: 'application/json' }));
  form.append('file', file);

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink,webContentLink',
    { method: 'POST', headers: { Authorization: `Bearer ${accessToken}` }, body: form }
  );
  const { webViewLink } = await res.json();
  // Store webViewLink as file_url in Turso — no BLOB needed
  await db.KBBDocument.update(docId, { file_url: webViewLink, file_type: 'google-doc' });
};
```

The `webViewLink` is a permanent, shareable Google Drive URL. Store it in the
existing `file_url` column — no schema change required.

---

## 9. Phase 7 — Replace Base44 Functions

Base44 serverless functions live in `base44/functions/*/entry.ts`. They run on
Base44's infrastructure and are called via `base44.functions.invoke(name, args)`.

### Option A — Inline `fetch()` (zero infrastructure)

If the function is a simple proxy to an external API (e.g., `fetchJsonUrl`),
call the external API directly from the browser. This works unless the target
blocks CORS.

```js
// Before
const res = await base44.functions.invoke('fetchJsonUrl', { url });
const raw = res.data.data;

// After
const res = await fetch(url);
const raw = await res.json();
```

### Option B — Cloudflare Workers (secrets, CORS proxy, email)

Use a Cloudflare Worker for anything that:
- Requires a secret (API key, webhook signing key)
- Needs to bypass CORS on an external API
- Sends emails (use [Resend](https://resend.com) inside the worker)
- Runs on a schedule (Cloudflare Cron Triggers)

```bash
npm create cloudflare@latest my-worker
cd my-worker
# copy the function logic from base44/functions/*/entry.ts
wrangler deploy
```

Vite dev proxy:

```js
server: { proxy: { '/api': 'https://my-worker.your-subdomain.workers.dev' } }
```

**Scheduled functions** — use [Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/):

```toml
# wrangler.toml
[triggers]
crons = ["0 9 * * *"]   # every day at 9:00 AM UTC
```

```ts
// worker/index.ts
export default {
  async scheduled(event, env) {
    // query Turso, send notifications, etc.
  },
};
```

### Option C — Azure Functions

Best choice if you are already in the Microsoft / Azure ecosystem or prefer
first-class VS Code tooling (run, debug, and deploy without leaving the editor).

```bash
npm install -g azure-functions-core-tools@4
func init api --worker-runtime node --language typescript
cd api && npm install @libsql/client jose @azure/functions
func new --name myFunction --template "HTTP trigger"
func start   # runs on http://localhost:7071
```

Vite dev proxy:

```js
server: { proxy: { '/api': 'http://localhost:7071/api' } }
```

**Scheduled functions** — use a Timer Trigger:

```ts
import { app, Timer, InvocationContext } from '@azure/functions';

app.timer('myScheduledTask', {
  schedule: '0 0 9 * * *',   // daily at 9:00 AM UTC
  handler: async (timer: Timer, ctx: InvocationContext) => {
    // query Turso, send notifications, etc.
  },
});
```

Secrets go in `api/local.settings.json` for dev (already gitignored), and in
**Application Settings** in the Azure portal for production.

See Phase 4c, Option B for a full auth-function example using Azure Functions.

### Comparing the Options

| | Option A: Inline fetch | Option B: Cloudflare Workers | Option C: Azure Functions |
|---|---|---|---|
| Infrastructure | None | Cloudflare account | Azure subscription |
| Cold start | N/A | None (V8 isolates) | ~200 ms (consumption plan) |
| Free tier | Always free | 100k req/day | 1M executions/month |
| Local dev | Browser DevTools | `wrangler dev` | `func start` (port 7071) |
| Scheduled tasks | ✗ | Cron Triggers | Timer Triggers |
| Runtime | Browser JS | JS/TS only | Node, .NET, Python, Java |
| VS Code integration | — | Wrangler CLI | Native Azure extension |
| Secrets management | ✗ (no server) | `wrangler secret` | App Settings / Key Vault |
| Best if you use… | Simple CORS-free APIs | Cloudflare CDN / Pages | Azure / Microsoft 365 / Entra ID |

**Rule of thumb**: start with Option A wherever possible. Use Option B or C only
when you need secrets, scheduled tasks, or a full auth backend. Choose B for
minimal ops overhead; choose C if you have an existing Azure footprint or want
Microsoft Entra ID (Azure AD) integration.

---

## 10. Phase 8 — Clean Up & Validate

### 10a. Final Grep Sweep

```bash
# Must return zero results when migration is complete
grep -r "base44" src --include="*.jsx" --include="*.tsx" --include="*.js"
```

Any remaining hits are call sites you missed. Work through them before proceeding.

### 10b. Remove Base44 Dependencies

```bash
npm uninstall @base44/sdk @base44/vite-plugin
```

Remove the Base44 plugin from `vite.config.js`:

```js
// Remove this import and its usage:
import { base44 } from '@base44/vite-plugin';

// Remove from plugins array:
plugins: [react(), base44({ ... })]
// becomes:
plugins: [react()]
```

### 10c. Build Check

```bash
npm run build   # must exit 0 with no errors
npm run lint    # fix any remaining ESLint warnings
```

### 10d. Smoke-Test Checklist

- [ ] `/login` loads and populates Orgs + Users from Turso
- [ ] Signing in sets session; hard-refreshing the page maintains session
- [ ] Dashboard loads documents, locations, and departments from Turso
- [ ] Creating a document writes a row (verify: `turso db shell your-db` → `SELECT * FROM kbb_documents LIMIT 3;`)
- [ ] Editing and deleting a document works
- [ ] Logout clears session and redirects to `/login`
- [ ] All settings pages (Teams, Locations, Departments, Fields, Layout) load and save correctly
- [ ] File preview works (if applicable)
- [ ] No `base44` errors in the browser console

### 10e. Commit and Push

```bash
git add -A
git commit -m "Migrate from base44 to Turso + custom auth"
git push origin main
```

---

## 11. Reference Patterns

### `src/api/tursoClient.js`

```js
import { createClient } from '@libsql/client/web';  // /web = browser build

export const turso = createClient({
  url:       import.meta.env.VITE_TURSO_DB_URL,
  authToken: import.meta.env.VITE_TURSO_TOKEN,
});
```

### `src/lib/AuthContext.jsx` — Dev session skeleton

```jsx
import React, { createContext, useState, useContext, useEffect } from 'react';
import { db } from '@/api/db';

const SESSION_KEY  = 'kbb_session_user_id';
const AuthContext  = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser]                     = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth]   = useState(true);

  useEffect(() => {
    const id = localStorage.getItem(SESSION_KEY);
    if (!id) { setIsLoadingAuth(false); return; }
    db.User.get(id)
      .then(u => { if (u) { setUser(u); setIsAuthenticated(true); } })
      .finally(() => setIsLoadingAuth(false));
  }, []);

  const login = async (userId) => {
    const u = await db.User.get(userId);
    if (!u) throw new Error('User not found');
    localStorage.setItem(SESSION_KEY, userId);
    setUser(u); setIsAuthenticated(true);
  };

  const logout = () => {
    localStorage.removeItem(SESSION_KEY);
    setUser(null); setIsAuthenticated(false);
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, isLoadingAuth, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
```

### Turso Parameterised Query Pattern

```js
// Always use named parameters (:name), not positional (?)
const rs = await turso.execute({
  sql:  'SELECT * FROM users WHERE email = :email AND role = :role',
  args: { email: 'user@example.com', role: 'admin' },
});

// rs.rows is an array of plain objects
const users = rs.rows;  // [{ id: '...', email: '...', role: '...' }]
```

### JSON Column Round-Trip

```js
// Write to Turso (in serializeRow)
JSON.stringify(['Site A', 'Site B'])       // stored as TEXT: '["Site A","Site B"]'

// Read from Turso (in parseRow)
JSON.parse(row.location ?? '[]')           // back to ['Site A', 'Site B']

// The db.js factory handles this automatically for columns declared in JSON_FIELDS
```

### Boolean Column Round-Trip

```js
// SQLite stores booleans as integers
// Write
is_archived: form.is_archived ? 1 : 0   // or just pass a boolean — db.js serializes it

// Read — db.js converts 0/1 to false/true for columns in BOOL_FIELDS
doc.is_archived  // → false (not 0)
```

### `db.js` — Add a Specialised Query

For queries that can't be expressed as a simple `filter(where)`, add a named
function directly below the `db` export:

```js
// src/api/db.js
export async function getOrgsForUser(userId, userRole) {
  if (userRole === 'admin') return db.Organization.list();
  const rs = await turso.execute({
    sql:  `SELECT o.*
           FROM organizations o
           INNER JOIN org_members m ON m.org_id = o.id
           WHERE m.user_id = :userId`,
    args: { userId },
  });
  return rs.rows.map(r => parseRow('organizations', r));
}
```

---

## 12. Decision Log

Decisions made during the initial migration (**docu-library-pro**, July 2026) that
informed this guide. Use as a reference when you encounter the same choices.

| Decision | Choice | Rationale |
|---|---|---|
| Auth service | Custom — Turso `users` table | No external dependency; full control; easy to extend |
| Auth Phase 1 | Dev auto-login dropdown picker | Fast to test the whole app without implementing bcrypt first |
| Auth Phase 2 | Cloudflare Worker + bcrypt + JWT | Free tier sufficient; zero cold-start; co-locates future API endpoints |
| File storage (dev) | `URL.createObjectURL()` (ephemeral) | No infrastructure needed to test file preview |
| File storage (prod) | Google Drive API | No size limits; no extra storage cost; integrates with existing Google Workspace |
| Real-time subscriptions | Removed; data fetches on mount | Turso has no WebSocket push; polling is sufficient for this app's cadence |
| Base44 functions | Direct `fetch()`, Cloudflare Workers, or Azure Functions | Simple proxy functions go client-side; secrets/scheduled tasks need a worker — choose Cloudflare for minimal ops, Azure if already in the Microsoft ecosystem |
| `@libsql/client` import | `@libsql/client/web` | The `/web` subpath is required for Vite browser builds; default entry is Node.js only |
| JSON arrays in SQLite | `TEXT DEFAULT '[]'` + `JSON_FIELDS` map in `db.js` | SQLite has no native array type; the factory handles parse/stringify transparently |
| Boolean columns in SQLite | `INTEGER DEFAULT 0` + `BOOL_FIELDS` map in `db.js` | SQLite has no native boolean; the factory converts 0/1 to true/false on read |
| ID generation | `crypto.randomUUID()` (browser built-in) | No extra package; available in all modern browsers and Node 18+ |
| Org membership for non-admins | JOIN `organizations` × `org_members` | Base44 filtered server-side; we replicate that logic in a `getOrgsForUser()` helper |
