# Swagger UI — API Documentation Plan

## Table of Contents

1. [Overview](#1-overview)
2. [Entities & Endpoints](#2-entities--endpoints)
3. [Existing Route Inventory](#3-existing-route-inventory)
4. [Proposed Swagger Setup](#4-proposed-swagger-setup)
5. [OpenAPI Specification File](#5-openapi-specification-file)
6. [Entity CRUD Endpoints (Complete Reference)](#6-entity-crud-endpoints-complete-reference)
7. [Custom RPC Endpoints](#7-custom-rpc-endpoints)
8. [Auth Endpoints](#8-auth-endpoints)
9. [Settings Endpoints](#9-settings-endpoints)
10. [File Upload/Download Endpoints](#10-file-uploaddownload-endpoints)
11. [Implementation Steps](#11-implementation-steps)
12. [Dependencies](#12-dependencies)
13. [Testing & Validation](#13-testing--validation)

---

## 1. Overview

The project has a fully functional **Express.js** backend with a generic entity CRUD API in `server/routes/api.js`, auth in `server/routes/auth.js`, settings in `server/routes/settings.js`, and file handling.

### Database Strategy

| Environment | Database | Purpose |
|---|---|---|
| **Development** | **Turso (SQLite)** | Local development and testing. Fast iteration, zero setup overhead, runs via `npm run dev:backend`. |
| **Production** | **SQL Server** | Deployed production environment. Full relational database with enterprise features, transactions, and scaling. |

The server layer (`server/lib/db.js`) abstracts CRUD operations behind a generic entity factory. A future migration step will add a **SQL Server driver** (e.g., `mssql` / `tedious`) and a driver-switching mechanism so the same route handlers work against both databases. The **Swagger UI** is network-layer documentation — it is database-agnostic and works identically regardless of which database backend is connected.

The goal is to add **Swagger UI** so developers and admins can:

- Browse all available API endpoints
- See request/response schemas for each entity
- Execute requests directly from the browser (try-it-out)
- Understand relationships between entities (foreign keys via `org_id`, `user_id`, etc.)

### Database Entities (10 tables)

| Table | Purpose | Key FK |
|---|---|---|
| `users` | Auth & user profiles | — |
| `organizations` | Multi-tenant orgs | — |
| `org_members` | User ↔ Org membership | `org_id`, `user_id` |
| `locations` | Sites per org | `org_id` |
| `departments` | Departments per org | `org_id` |
| `teams` | Teams per org (with member list) | `org_id` |
| `kbb_documents` | Safety data sheets / documents | `org_id` |
| `custom_fields` | Dynamic field definitions per org | `org_id` |
| `field_configs` | Layout configuration per org | `org_id` |
| `notifications` | User notifications | `user_id`, `org_id`, `document_id` |
| `app_settings` | Global key/value config (non-entity) | — |

---

## 2. Entities & Endpoints

The generic entity router at `server/routes/api.js` exposes these endpoints for **all 10 entities**:

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/:entity` | List all records for an entity |
| `POST` | `/api/:entity/filter` | Filter records with `where`, `sort`, `limit` |
| `GET` | `/api/:entity/:id` | Get a single record by ID |
| `POST` | `/api/:entity` | Create a new record |
| `PATCH` | `/api/:entity/:id` | Update a record by ID |
| `DELETE` | `/api/:entity/:id` | Delete a record by ID |

Where `:entity` = one of: `Organization`, `Location`, `Department`, `KBBDocument`, `CustomField`, `FieldConfig`, `Team`, `OrgMember`, `Notification`, `User`.

---

## 3. Existing Route Inventory

| Route File | Base Path | Endpoints |
|---|---|---|
| `server/routes/api.js` | `/api` | `GET /:entity`, `POST /:entity/filter`, `GET /:entity/:id`, `POST /:entity`, `PATCH /:entity/:id`, `DELETE /:entity/:id` |
| `server/routes/api.js` | `/api` | `POST /kbb_documents/:id/file` (upload), `GET /kbb_documents/:id/file` (download) |
| `server/routes/api.js` | `/api` | `POST /rpc/:name` (specialized queries) |
| `server/routes/auth.js` | `/api/auth` | `POST /login`, `POST /login-with-password` |
| `server/routes/settings.js` | `/api/settings` | `GET /:key`, `PUT /:key` (requires auth + admin) |
| `server/routes/health.js` | `/api/health` | `GET /` — health check |
| `server/routes/info.js` | `/api/info` | `GET /` — app info |

---

## 4. Proposed Swagger Setup

### Approach: `swagger-jsdoc` + `swagger-ui-express`

This is the most common Express + Swagger setup. It uses JSDoc-style annotations in route files to generate the OpenAPI spec automatically, keeping the spec close to the code.

### Why this approach

1. **Spec lives next to routes** — annotations stay in sync with code
2. **No manual spec file drift** — regenerated on each server start
3. **Familiar pattern** — used by thousands of Express APIs
4. **JSDoc format** — easy to read and write

### Installation

```bash
npm install swagger-jsdoc swagger-ui-express
```

### Server Integration (in `server/index.js`)

```js
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'KBB Portal API',
      version: '1.0.0',
      description: 'REST API for the Knowledge Base Document Library. '
        + 'Provides CRUD operations for organizations, locations, departments, '
        + 'documents, teams, users, and more.',
    },
    servers: [
      { url: `http://localhost:${PORT}`, description: 'Development server' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        // ... entity schemas defined in annotations
      },
    },
  },
  apis: ['./server/routes/*.js'],  // scan route files for JSDoc annotations
});

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  explorer: true,
  customSiteTitle: 'KBB Portal API Docs',
}));
```

### URL

Swagger UI will be available at: **`http://localhost:3001/api-docs`**

---

## 5. OpenAPI Specification File (Alternative Approach)

As an **alternative or supplement**, a static `openapi.json` file can be generated and placed at `server/openapi.json`. This provides:

- A standalone spec that can be imported into external tools (Postman, Insomnia)
- CI validation (e.g., spectral linting)
- Documentation without needing the server running

### Example Structure for `server/openapi.json`

```json
{
  "openapi": "3.0.0",
  "info": {
    "title": "KBB Portal API",
    "version": "1.0.0",
    "description": "REST API for Knowledge Base Document Library"
  },
  "paths": {
    "/api/Organization": {
      "get": { ... },
      "post": { ... }
    },
    "/api/Organization/{id}": {
      "get": { ... },
      "patch": { ... },
      "delete": { ... }
    },
    "/api/Organization/filter": {
      "post": { ... }
    },
    // ... repeat for all entities
  }
}
```

### Recommendation

Use **both**:
- `swagger-jsdoc` annotations in route files for the live Swagger UI
- Generate a static `openapi.json` (or `.yaml`) that can be committed to the repo

---

## 6. Entity CRUD Endpoints (Complete Reference)

For each of the 10 entities, the following endpoints exist. Below are the schemas and annotations needed.

### Entity: `Organization`

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string (UUID) | auto | Primary key |
| `name` | string | Yes | Org name |
| `description` | string | No | |
| `admin_user_ids` | array[string] | No | JSON array stored as TEXT |
| `slug` | string | No | URL-friendly identifier |
| `is_active` | boolean | No | Default: `true`, stored as 0/1 |
| `created_date` | string (ISO-8601) | auto | |
| `updated_date` | string (ISO-8601) | auto | |
| `created_by_id` | string | No | |

### Entity: `Location`

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string (UUID) | auto | |
| `org_id` | string (UUID) | Yes | FK → organizations.id |
| `name` | string | Yes | Site name |
| `is_active` | boolean | No | Default: `true`, stored as 0/1 |
| `pinned` | boolean | No | Default: `false`, stored as 0/1 |
| `created_date` | string (ISO-8601) | auto | |
| `updated_date` | string (ISO-8601) | auto | |
| `created_by_id` | string | No | |

### Entity: `Department`

Same structure as `Location` (minus `pinned`), referencing `org_id`.

### Entity: `KBBDocument`

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string (UUID) | auto | |
| `org_id` | string (UUID) | Yes | FK → organizations.id |
| `title` | string | Yes | Document title |
| `description` | string | No | |
| `document_id` | string | No | Custom document identifier |
| `link_url` | string | No | External URL |
| `file_url` | string | No | Original filename |
| `file_type` | string | No | `pdf`, `word`, `excel`, `google-doc`, `url` |
| `file_blob` | binary | No | Stored as BLOB in SQLite |
| `tags` | array[string] | No | JSON array |
| `location` | array[string] | No | JSON array of site names |
| `department` | array[string] | No | JSON array of dept names |
| `renew_date` | string (date) | No | ISO-8601 date (YYYY-MM-DD) |
| `renew_notified_30` | boolean | No | Stored as 0/1 |
| `renew_notified_7` | boolean | No | Stored as 0/1 |
| `visibility` | string | No | `everyone` or `teams` |
| `allowed_team_ids` | array[string] | No | JSON array of team IDs |
| `creator_user_id` | string | No | |
| `custom_field_values` | object | No | JSON object |
| `is_archived` | boolean | No | Stored as 0/1 |
| `created_date` | string (ISO-8601) | auto | |
| `updated_date` | string (ISO-8601) | auto | |
| `created_by_id` | string | No | |

### Entity: `CustomField`

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string (UUID) | auto | |
| `org_id` | string (UUID) | Yes | FK → organizations.id |
| `name` | string | Yes | Field name |
| `input_type` | string | Yes | Enum: `text-short`, `text-paragraph`, `single-select`, `multi-select` |
| `options` | array[string] | No | JSON array |
| `display_order` | number | No | Default: 0 |
| `status` | string | No | `active` or `inactive` |
| `created_date` | string (ISO-8601) | auto | |
| `updated_date` | string (ISO-8601) | auto | |
| `created_by_id` | string | No | |

### Entity: `FieldConfig`

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string (UUID) | auto | |
| `org_id` | string (UUID) | Yes | FK → organizations.id, unique |
| `hidden_required_fields` | array[string] | No | JSON array |
| `add_screen_order` | array[string] | No | JSON array |
| `view_screen_order` | array[string] | No | JSON array |
| `dashboard_columns` | array[object] | No | JSON array of `{key,label,display_mode}` |
| `created_date` | string (ISO-8601) | auto | |
| `updated_date` | string (ISO-8601) | auto | |
| `created_by_id` | string | No | |

### Entity: `Team`

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string (UUID) | auto | |
| `org_id` | string (UUID) | Yes | FK → organizations.id |
| `name` | string | Yes | |
| `description` | string | No | |
| `member_user_ids` | array[string] | No | JSON array of user IDs |
| `created_date` | string (ISO-8601) | auto | |
| `updated_date` | string (ISO-8601) | auto | |
| `created_by_id` | string | No | |

### Entity: `OrgMember`

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string (UUID) | auto | |
| `org_id` | string (UUID) | Yes | FK → organizations.id |
| `user_id` | string (UUID) | Yes | FK → users.id |
| `role` | string | Yes | Enum: `org_admin`, `team_member`, `standard_user` |
| `created_date` | string (ISO-8601) | auto | |
| `updated_date` | string (ISO-8601) | auto | |
| `created_by_id` | string | No | |

### Entity: `Notification`

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string (UUID) | auto | |
| `user_id` | string (UUID) | Yes | FK → users.id |
| `org_id` | string (UUID) | No | FK → organizations.id |
| `document_id` | string (UUID) | No | FK → kbb_documents.id |
| `type` | string | Yes | Enum: `renewal_30`, `renewal_7`, `renewal_overdue` |
| `message` | string | Yes | |
| `is_read` | boolean | No | Stored as 0/1 |
| `document_title` | string | No | |
| `created_date` | string (ISO-8601) | auto | |
| `updated_date` | string (ISO-8601) | auto | |
| `created_by_id` | string | No | |

### Entity: `User`

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string (UUID) | auto | |
| `full_name` | string | No | |
| `email` | string | No | |
| `role` | string | Yes | `user` or `admin` |
| `password_hash` | string | — | **Never exposed via API** (stripped in `parseRow`) |
| `created_date` | string (ISO-8601) | auto | |
| `updated_date` | string (ISO-8601) | auto | |

### JSON & Boolean Serialization Notes

- JSON array/object fields (`tags`, `location`, `department`, `allowed_team_ids`, `custom_field_values`, `admin_user_ids`, `options`, `hidden_required_fields`, `add_screen_order`, `view_screen_order`, `dashboard_columns`, `member_user_ids`) are stored as TEXT in SQLite.
- The server automatically `JSON.parse`s on read and `JSON.stringify`s on write via the `serializeRow`/`parseRow` helpers in `server/lib/db.js`.
- Boolean fields (`is_active`, `pinned`, `renew_notified_30`, `renew_notified_7`, `is_archived`, `is_read`) are stored as integers (0/1) and automatically converted to JS booleans on read.
- **Swagger spec must document these fields as their JS types** (array, object, boolean), not as raw TEXT/integer.

---

## 7. Custom RPC Endpoints

Defined in `server/routes/api.js` at `POST /api/rpc/:name`.

| RPC Name | Method | Description |
|---|---|---|
| `getOrgsForUser` | POST | Get organizations for a user (admin sees all) |
| `getOrgMembersWithUsers` | POST | Get all users with org membership status |
| `addOrgMember` | POST | Add a user to an org (creates user if needed by email) |
| `addExistingUserToOrg` | POST | Add an existing user to an org by ID |
| `updateOrgMember` | POST | Update member info (name, email, role) |
| `removeOrgMember` | POST | Remove a member from an org |

### Request/Response Schemas

#### `getOrgsForUser`
```json
// Request
{ "userId": "uuid-string", "userRole": "admin" }

// Response
[
  { "id": "uuid", "name": "...", "description": "...", ... }
]
```

#### `getOrgMembersWithUsers`
```json
// Request
{ "orgId": "uuid-string" }

// Response
[
  {
    "id": "uuid",
    "full_name": "...",
    "email": "user@example.com",
    "role": "user",
    "member_id": "uuid-or-null",
    "org_role": "org_admin-or-null"
  }
]
```

#### `addOrgMember`
```json
// Request
{
  "orgId": "uuid-string",
  "form": { "full_name": "New User", "email": "new@example.com", "role": "standard_user" }
}

// Response
{ "id": "uuid", "org_id": "...", "user_id": "...", "role": "standard_user", ... }
```

#### `updateOrgMember`
```json
// Request
{
  "memberId": "uuid-string",
  "userId": "uuid-string",
  "data": { "full_name": "...", "email": "...", "role": "org_admin" }
}

// Response
{ /* updated OrgMember row */ }
```

#### `removeOrgMember`
```json
// Request
{ "memberId": "uuid-string" }

// Response
204 No Content
```

---

## 8. Auth Endpoints

Defined in `server/routes/auth.js`.

### `POST /api/auth/login`
Select-mode login using userId.

```json
// Request
{ "userId": "uuid-string", "organizationId": "uuid-string-or-null" }

// Response
{ "token": "jwt-string", "user": { "id": "...", "full_name": "...", "email": "...", "role": "..." }, "organizationId": "..." }
```

### `POST /api/auth/login-with-password`
Full auth login with email + password.

```json
// Request
{ "email": "user@example.com", "password": "..." }

// Response
{ "token": "jwt-string", "user": { "id": "...", "full_name": "...", "email": "...", "role": "..." } }
```

---

## 9. Settings Endpoints

Defined in `server/routes/settings.js`.

### `GET /api/settings/:key`
Get a setting value. Supported keys: `login_mode`, `maintenance_message`.

```json
// Response
{ "key": "login_mode", "value": "select" }
```

### `PUT /api/settings/:key`
Update a setting (requires JWT + admin role).

```json
// Request
{ "value": "password" }

// Response
{ "key": "login_mode", "value": "password" }
```

Valid `login_mode` values: `select`, `password`, `maintenance`.

---

## 10. File Upload/Download Endpoints

Defined in `server/routes/api.js`.

### `POST /api/kbb_documents/:id/file`
Upload a file (BLOB storage) for a KBB document.

- Content-Type: `multipart/form-data`
- Body: `file` field (max 10 MB)

```json
// Response — full KBBDocument object with updated file fields
```

### `GET /api/kbb_documents/:id/file`
Download/stream a stored file.

- Response: Binary file with `Content-Type` and `Content-Disposition` headers.
- Returns 404 if no file blob exists.

---

## 11. Implementation Steps

### Step 1: Install Dependencies

```bash
npm install swagger-jsdoc swagger-ui-express
```

### Step 2: Add JSDoc Annotations to Route Files

For the generic entity router (`server/routes/api.js`), add a single set of annotations that documents the dynamic `:entity` parameter. For example:

```js
/**
 * @openapi
 * /api/{entity}:
 *   get:
 *     summary: List all records for an entity
 *     tags: [Entities]
 *     parameters:
 *       - in: path
 *         name: entity
 *         required: true
 *         schema:
 *           type: string
 *           enum: [Organization, Location, Department, KBBDocument, CustomField, FieldConfig, Team, OrgMember, Notification, User]
 *         description: Entity name
 *     responses:
 *       200:
 *         description: Array of records
 *       404:
 *         description: Unknown entity
 */
```

Repeat for each HTTP method (`get /:entity`, `post /:entity/filter`, `get /:entity/:id`, `post /:entity`, `patch /:entity/:id`, `delete /:entity/:id`).

Add annotations for:
- Auth routes (`server/routes/auth.js`)
- Settings routes (`server/routes/settings.js`)
- RPC routes (`server/routes/api.js` — the `POST /rpc/:name` block)
- File upload/download routes
- Health & info routes

### Step 3: Define Component Schemas

In the `swaggerJsdoc` definition object (or via a separate `@openapi` block in a config file), define reusable `components.schemas` for each entity.

Example:

```js
components: {
  schemas: {
    Organization: {
      type: 'object',
      properties: {
        id:          { type: 'string', format: 'uuid', description: 'Primary key' },
        name:        { type: 'string', description: 'Organization name' },
        description: { type: 'string' },
        admin_user_ids: { type: 'array', items: { type: 'string' }, description: 'JSON array of admin user IDs' },
        slug:        { type: 'string' },
        is_active:   { type: 'boolean', default: true },
        created_date:  { type: 'string', format: 'date-time' },
        updated_date:  { type: 'string', format: 'date-time' },
        created_by_id: { type: 'string', format: 'uuid' },
      },
      required: ['name'],
    },
    Location: {
      type: 'object',
      properties: {
        id:         { type: 'string', format: 'uuid' },
        org_id:     { type: 'string', format: 'uuid', description: 'FK → organizations.id' },
        name:       { type: 'string' },
        is_active:  { type: 'boolean', default: true },
        pinned:     { type: 'boolean', default: false },
        created_date:  { type: 'string', format: 'date-time' },
        updated_date:  { type: 'string', format: 'date-time' },
        created_by_id: { type: 'string', format: 'uuid' },
      },
      required: ['org_id', 'name'],
    },
    // ... all other entities
  }
}
```

### Step 4: Wire Up Swagger in `server/index.js`

Add the swagger setup before the existing route registrations (but after `express.json()`).

```js
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

const options = {
  definition: {
    openapi: '3.0.0',
    info: { title: 'KBB Portal API', version: '1.0.0', description: '...' },
    servers: [{ url: `http://localhost:${PORT}` }],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      },
      schemas: { /* all entity schemas */ },
    },
  },
  apis: ['./server/routes/*.js'],
};

const swaggerSpec = swaggerJsdoc(options);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, { explorer: true }));
```

### Step 5: Serve `openapi.json` (Optional but Recommended)

```js
app.get('/api-docs.json', (req, res) => res.json(swaggerSpec));
```

This provides a downloadable spec file for external tools.

### Step 6: Generate Static `openapi.yaml`

Use `swagger-cli` or a build script to export a static spec file:

```bash
# Option A: swagger-cli
npx swagger-cli bundle -o docs/api/openapi.yaml -t yaml server/openapi.json

# Option B: Build script in package.json scripts
"generate-docs": "node scripts/generate-openapi.js"
```

The static file can be committed to the repo for CI/PR review.

### Step 7: Add Bearer Auth to Protected Routes (Optional Enhancement)

The settings `PUT` route requires JWT auth. Annotate it with:

```js
/**
 * @openapi
 * /api/settings/{key}:
 *   put:
 *     summary: Update a setting (requires admin)
 *     tags: [Settings]
 *     security:
 *       - bearerAuth: []
 *     ...
 */
```

## 12. Dependencies

### Production Dependencies (to install)

```bash
npm install swagger-jsdoc swagger-ui-express
```

No additional runtime config changes needed.

### Total Disk Impact

- `swagger-jsdoc`: ~2 MB
- `swagger-ui-express`: ~6 MB (includes Swagger UI static assets)
- Combined: ~8 MB

## 13. Testing & Validation

### After Implementation

1. Start the server: `npm run dev:backend`
2. Open: `http://localhost:3001/api-docs`
3. Verify all 10 entities appear in the Swagger UI
4. Try executing a `GET /api/Organization` — should return auth-free data
5. Try executing a `POST /api/Organization` with body `{ "name": "Test Org" }`
6. Try executing the filter endpoint with a where clause
7. Verify the auth endpoints show the correct request body format
8. Verify file upload/download endpoints show multipart form

### Validation Checklist

- [ ] All 10 entity CRUD endpoints documented
- [ ] Request/response schemas match actual DB columns
- [ ] JSON array fields documented as arrays (not strings)
- [ ] Boolean fields documented as booleans (not integers)
- [ ] Auth endpoints show correct request format
- [ ] Settings endpoints documented
- [ ] RPC endpoints documented with request/response schemas
- [ ] File upload/download endpoints documented
- [ ] JWT auth documented for protected routes
- [ ] `openapi.json` endpoint accessible at `/api-docs.json`
- [ ] Static spec file generated and committed to repo (optional)

---

## Appendix: Example JSDoc Annotations for a Single Entity

### List Endpoint

```js
/**
 * @openapi
 * /api/Organization:
 *   get:
 *     summary: List all organizations
 *     tags: [Organizations]
 *     responses:
 *       200:
 *         description: Array of organizations
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Organization'
 */
```

### Create Endpoint

```js
/**
 * @openapi
 * /api/Organization:
 *   post:
 *     summary: Create a new organization
 *     tags: [Organizations]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name:        { type: string }
 *               description: { type: string }
 *               slug:        { type: string }
 *               is_active:   { type: boolean, default: true }
 *               admin_user_ids: { type: array, items: { type: string } }
 *     responses:
 *       201:
 *         description: Created organization
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Organization'
 */
```

### Get by ID Endpoint

```js
/**
 * @openapi
 * /api/Organization/{id}:
 *   get:
 *     summary: Get an organization by ID
 *     tags: [Organizations]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Organization object
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Organization'
 *       404:
 *         description: Not found
 */
```

### Update Endpoint

```js
/**
 * @openapi
 * /api/Organization/{id}:
 *   patch:
 *     summary: Update an organization
 *     tags: [Organizations]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:        { type: string }
 *               description: { type: string }
 *               slug:        { type: string }
 *               is_active:   { type: boolean }
 *               admin_user_ids: { type: array, items: { type: string } }
 *     responses:
 *       200:
 *         description: Updated organization
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Organization'
 */
```

### Delete Endpoint

```js
/**
 * @openapi
 * /api/Organization/{id}:
 *   delete:
 *     summary: Delete an organization
 *     tags: [Organizations]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       204:
 *         description: Deleted successfully
 *       404:
 *         description: Not found
 */