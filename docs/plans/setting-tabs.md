## Organizing Setting Tabs ##

## Overview

The Settings page currently renders as a single flat accordion list of sections. As the section count grows, the page becomes overwhelming and difficult to navigate. This plan introduces a **tabbed interface** for the Settings page, where:

1. **Tabs** are named containers that group related settings sections.
2. **Super Admins** can create, edit, reorder, and delete custom tabs.
3. **Tabs can be scoped** to `all` (visible to Admin + Super Admin) or `super_admin` (visible only to Super Admin).
4. **Existing accordion sections** become draggable items that can be reordered within a tab or **moved between tabs** via drag-and-drop.
5. **Section-to-tab assignments** and **tab order** are persisted in the database (not localStorage).
6. All persistence is verified through API endpoints that return the saved state so the client can confirm writes.

---

## Decisions Captured

| Decision | Choice |
| --- | --- |
| Database | New `settings_tabs` + `settings_tab_sections` tables (schema managed in `SCHEMA_STATEMENTS`) |
| Tab visibility model | `visible_to` column: `'all'` or `'super_admin'` |
| Initial tabs (4) | General (all), Configuration (all), Storage (all), Private (super_admin) |
| Section-to-tab assignment | Stored in `settings_tab_sections` with `section_key` referencing the existing `SettingsAccordionSection` union values |
| Drag-and-drop library | `@dnd-kit/core` + `@dnd-kit/sortable` (already in `package.json` if available, otherwise install) |
| Tab management | Super Admin only via a "Manage Tabs" UI within the Settings area |
| Section ordering | `sort_order` integer on `settings_tab_sections`; re-indexed on save |
| Tab ordering | `sort_order` integer on `settings_tabs`; re-indexed on save |
| API pattern | RESTful: `GET/POST/PATCH/DELETE /api/settings/tabs` and `GET/PATCH /api/settings/tabs/:tabId/sections` |
| API verification | Every mutation endpoint **returns the full saved state** from the database so the client can confirm persistence |
| Backward compatibility | If no tabs exist in DB, fall back to a default hardcoded tab set matching the initial seed |
| localStorage migration | Existing `SettingsAccordionOrder` in localStorage is **ignored** once tabs are loaded from the server |

---

## Current Behavior (baseline)

### Backend

- No tabs table exists — sections are purely a frontend concept.


### Frontend


- Each section renders via with drag handles.


## Phase 1 — Database Schema

### 1.1 `settings_tabs` table

**File:** `docu-library-pro-copy/server/db.ts` — add to `SCHEMA_STATEMENTS` array

```sql
CREATE TABLE IF NOT EXISTS settings_tabs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  visible_to TEXT NOT NULL DEFAULT 'all' CHECK(visible_to IN ('all', 'super_admin')),
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
)
```

### 1.2 `settings_tab_sections` table

```sql
CREATE TABLE IF NOT EXISTS settings_tab_sections (
  id TEXT PRIMARY KEY,
  tab_id TEXT NOT NULL,
  section_key TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (tab_id) REFERENCES settings_tabs(id) ON DELETE CASCADE,
  UNIQUE (tab_id, section_key)
)
```

The `section_key` column stores the `SettingsAccordionSection` value (e.g., `'appearance'`, `'authentication'`, etc.).

### 1.3 Initial seed data

**File:** `docu-library-pro-copy/server/db.ts` — add to seed logic in `initDb`

```tsx
const seedSettingsTabs = async (db: Client): Promise<void> => {
  const countRow = await db.execute('SELECT COUNT(1) AS cnt FROM settings_tabs')
  if (Number(countRow.rows[0]?.cnt ?? 0) > 0) return

  const { randomUUID } = await import('node:crypto')
  const now = new Date().toISOString()

  const tabs = [
    { name: 'General', slug: 'general', sort_order: 0, visible_to: 'all' },
    { name: 'Configuration', slug: 'configuration', sort_order: 1, visible_to: 'all' },
    { name: 'Storage', slug: 'storage', sort_order: 2, visible_to: 'all' },
    { name: 'Private', slug: 'private', sort_order: 3, visible_to: 'super_admin' },
  ]

  for (const tab of tabs) {
    const tabId = randomUUID()
    await db.execute({
      sql: `INSERT INTO settings_tabs (id, name, slug, sort_order, visible_to, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [tabId, tab.name, tab.slug, tab.sort_order, tab.visible_to, now, now],
    })
  }

  // Seed default section assignments
  const tabRows = await db.execute('SELECT id, slug FROM settings_tabs ORDER BY sort_order')
  const tabMap: Record<string, string> = {}
  for (const row of tabRows.rows) {
    tabMap[String(row.slug)] = String(row.id)
  }

  const defaultAssignments: Record<string, string[]> = {
    general: [
      'appearance', 'loginMode', 'manageOrganizations', 'manageUsers',
      'manageTeams', 'aboutPage',
    ],
    configuration: [
      'authentication', 'categories', 'locations', 'powerBi',
      'trendSeeding', 'ticketSeeding',
    ],
    storage: [
      'email', 'feedbackForm', 'webhooks',
    ],
    private: [
      'anonymousPages',
    ],
  }

  for (const [slug, sections] of Object.entries(defaultAssignments)) {
    const tabId = tabMap[slug]
    if (!tabId) continue
    for (let i = 0; i < sections.length; i++) {
      await db.execute({
        sql: `INSERT OR IGNORE INTO settings_tab_sections (id, tab_id, section_key, sort_order, created_at)
              VALUES (?, ?, ?, ?, ?)`,
        args: [randomUUID(), tabId, sections[i], i, now],
      })
    }
  }

  console.log('Settings tabs seeded with 4 default tabs and section assignments.')
}
```

Call `await seedSettingsTabs(db)` inside `initDb` after the existing seed calls.

---

## Phase 2 — Server-Side Types & Data Access Layer

### 2.1 New types

**File:** `docu-library-pro-copy/server/settings-tabs.ts` (new file)

```tsx
import { getDb, dbAll, dbGet, dbRun, type Row } from './db.js'

export interface SettingsTab {
  id: string
  name: string
  slug: string
  sort_order: number
  visible_to: 'all' | 'super_admin'
  created_at: string
  updated_at: string
  sections: SettingsTabSection[]
}

export interface SettingsTabSection {
  id: string
  tab_id: string
  section_key: string
  sort_order: number
}

export interface SettingsTabInput {
  name: string
  slug: string
  visible_to: 'all' | 'super_admin'
}

export interface SettingsTabsResponse {
  tabs: SettingsTab[]
}
```

### 2.2 CRUD functions

**File:** `docu-library-pro-copy/server/settings-tabs.ts`

```tsx
// List all tabs with their sections
export const listSettingsTabs = async (): Promise<SettingsTab[]> => {
  const db = getDb()
  const tabs = await dbAll(db, 'SELECT * FROM settings_tabs ORDER BY sort_order ASC')
  const sections = await dbAll(db, 'SELECT * FROM settings_tab_sections ORDER BY sort_order ASC')

  return tabs.map((row: Row) => ({
    id: String(row.id),
    name: String(row.name),
    slug: String(row.slug),
    sort_order: Number(row.sort_order),
    visible_to: String(row.visible_to) as 'all' | 'super_admin',
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
    sections: sections
      .filter((s: Row) => String(s.tab_id) === String(row.id))
      .map((s: Row) => ({
        id: String(s.id),
        tab_id: String(s.tab_id),
        section_key: String(s.section_key),
        sort_order: Number(s.sort_order),
      })),
  }))
}

// Get tabs visible to a specific role
export const listVisibleSettingsTabs = async (role: string): Promise<SettingsTab[]> => {
  const allTabs = await listSettingsTabs()
  return allTabs.filter((tab) => {
    if (tab.visible_to === 'super_admin' && role !== 'Super Admin') return false
    return true
  })
}

// Create a new tab
export const createSettingsTab = async (input: SettingsTabInput): Promise<SettingsTab | null> => {
  const db = getDb()
  const { randomUUID } = await import('node:crypto')
  const id = randomUUID()
  const now = new Date().toISOString()

  // Get next sort_order
  const maxRow = await dbGet(db, 'SELECT MAX(sort_order) AS max_order FROM settings_tabs')
  const sortOrder = (Number(maxRow?.max_order ?? -1)) + 1

  const result = await dbRun(db,
    `INSERT INTO settings_tabs (id, name, slug, sort_order, visible_to, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, input.name, input.slug, sortOrder, input.visible_to, now, now],
  )

  if (result.rowsAffected === 0) return null

  // Return the full tab with empty sections for verification
  return {
    id, name: input.name, slug: input.slug, sort_order: sortOrder,
    visible_to: input.visible_to, created_at: now, updated_at: now,
    sections: [],
  }
}

// Update a tab (name, visible_to)
export const updateSettingsTab = async (
  tabId: string,
  patch: { name?: string; visible_to?: 'all' | 'super_admin' },
): Promise<SettingsTab | null> => {
  const db = getDb()
  const now = new Date().toISOString()

  const existing = await dbGet(db, 'SELECT * FROM settings_tabs WHERE id = ?', [tabId])
  if (!existing) return null

  const name = patch.name ?? String(existing.name)
  const visibleTo = patch.visible_to ?? String(existing.visible_to)

  await dbRun(db,
    'UPDATE settings_tabs SET name = ?, visible_to = ?, updated_at = ? WHERE id = ?',
    [name, visibleTo, now, tabId],
  )

  // Return full tab from DB for verification
  const tabs = await listSettingsTabs()
  return tabs.find((t) => t.id === tabId) ?? null
}

// Delete a tab and its sections (CASCADE handles sections)
export const deleteSettingsTab = async (tabId: string): Promise<boolean> => {
  const db = getDb()
  const result = await dbRun(db, 'DELETE FROM settings_tabs WHERE id = ?', [tabId])
  return result.rowsAffected > 0
}

// Reorder tabs (accepts ordered array of tab IDs)
export const reorderSettingsTabs = async (orderedIds: string[]): Promise<SettingsTab[]> => {
  const db = getDb()
  const now = new Date().toISOString()
  for (let i = 0; i < orderedIds.length; i++) {
    await dbRun(db,
      'UPDATE settings_tabs SET sort_order = ?, updated_at = ? WHERE id = ?',
      [i, now, orderedIds[i]],
    )
  }
  return listSettingsTabs()
}

// Update sections for a tab (full replacement — ordered array of section_keys)
export const updateTabSections = async (
  tabId: string,
  sectionKeys: string[],
): Promise<SettingsTabSection[]> => {
  const db = getDb()
  const { randomUUID } = await import('node:crypto')
  const now = new Date().toISOString()

  // Delete existing sections for this tab
  await dbRun(db, 'DELETE FROM settings_tab_sections WHERE tab_id = ?', [tabId])

  // Insert new sections in order
  const sections: SettingsTabSection[] = []
  for (let i = 0; i < sectionKeys.length; i++) {
    const id = randomUUID()
    await dbRun(db,
      `INSERT INTO settings_tab_sections (id, tab_id, section_key, sort_order, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [id, tabId, sectionKeys[i], i, now],
    )
    sections.push({ id, tab_id: tabId, section_key: sectionKeys[i], sort_order: i })
  }

  return sections
}
```

---

## Phase 3 — API Routes

### 3.1 Tab management routes

**File:** `docu-library-pro-copy/server/routes/settings-tabs.ts` (new file)

```tsx
import { Router } from 'express'
import { requireAdmin, requireSuperAdmin } from '../middleware.js'
import {
  listSettingsTabs,
  listVisibleSettingsTabs,
  createSettingsTab,
  updateSettingsTab,
  deleteSettingsTab,
  reorderSettingsTabs,
  updateTabSections,
} from '../settings-tabs.js'

export const settingsTabsRouter = Router()

// GET /api/settings/tabs — returns tabs filtered by role
settingsTabsRouter.get('/tabs', requireAdmin, async (req, res) => {
  try {
    const user = req.user!
    // Super Admin sees all tabs; Admin sees only visible_to = 'all'
    const tabs = await listVisibleSettingsTabs(user.role)
    res.json({ tabs })
  } catch (error) {
    console.error('Failed to list settings tabs.', error)
    res.status(500).json({ error: 'settings_tabs_list_failed' })
  }
})

// POST /api/settings/tabs — create a new tab (Super Admin only)
settingsTabsRouter.post('/tabs', requireSuperAdmin, async (req, res) => {
  const { name, slug, visible_to } = req.body ?? {}
  if (typeof name !== 'string' || !name.trim()) {
    res.status(400).json({ error: 'tab_name_required' })
    return
  }
  if (typeof slug !== 'string' || !slug.trim()) {
    res.status(400).json({ error: 'tab_slug_required' })
    return
  }
  if (visible_to !== 'all' && visible_to !== 'super_admin') {
    res.status(400).json({ error: 'invalid_visible_to', allowed: ['all', 'super_admin'] })
    return
  }

  try {
    const tab = await createSettingsTab({ name: name.trim(), slug: slug.trim(), visible_to })
    if (!tab) {
      res.status(409).json({ error: 'tab_slug_conflict' })
      return
    }
    // Return full tab list for verification
    const tabs = await listSettingsTabs()
    res.status(201).json({ tab, tabs })
  } catch (error) {
    console.error('Failed to create settings tab.', error)
    res.status(500).json({ error: 'settings_tab_create_failed' })
  }
})

// PATCH /api/settings/tabs/:tabId — update a tab (Super Admin only)
settingsTabsRouter.patch('/tabs/:tabId', requireSuperAdmin, async (req, res) => {
  const tabId = req.params.tabId
  if (!tabId) {
    res.status(400).json({ error: 'invalid_tab_id' })
    return
  }

  const patch: { name?: string; visible_to?: 'all' | 'super_admin' } = {}
  if (typeof req.body?.name === 'string' && req.body.name.trim()) {
    patch.name = req.body.name.trim()
  }
  if (req.body?.visible_to === 'all' || req.body?.visible_to === 'super_admin') {
    patch.visible_to = req.body.visible_to
  }

  if (Object.keys(patch).length === 0) {
    res.status(400).json({ error: 'no_valid_fields_to_update' })
    return
  }

  try {
    const tab = await updateSettingsTab(tabId, patch)
    if (!tab) {
      res.status(404).json({ error: 'tab_not_found' })
      return
    }
    // Return full tab list for verification
    const tabs = await listSettingsTabs()
    res.json({ tab, tabs })
  } catch (error) {
    console.error('Failed to update settings tab.', error)
    res.status(500).json({ error: 'settings_tab_update_failed' })
  }
})

// DELETE /api/settings/tabs/:tabId — delete a tab (Super Admin only)
settingsTabsRouter.delete('/tabs/:tabId', requireSuperAdmin, async (req, res) => {
  const tabId = req.params.tabId
  if (!tabId) {
    res.status(400).json({ error: 'invalid_tab_id' })
    return
  }

  try {
    const deleted = await deleteSettingsTab(tabId)
    if (!deleted) {
      res.status(404).json({ error: 'tab_not_found' })
      return
    }
    // Return remaining tabs for verification
    const tabs = await listSettingsTabs()
    res.json({ deleted: true, tabs })
  } catch (error) {
    console.error('Failed to delete settings tab.', error)
    res.status(500).json({ error: 'settings_tab_delete_failed' })
  }
})

// PUT /api/settings/tabs/reorder — reorder tabs (Super Admin only)
settingsTabsRouter.put('/tabs/reorder', requireSuperAdmin, async (req, res) => {
  const orderedIds = req.body?.orderedIds
  if (!Array.isArray(orderedIds) || orderedIds.some((id: unknown) => typeof id !== 'string')) {
    res.status(400).json({ error: 'ordered_ids_array_required' })
    return
  }

  try {
    const tabs = await reorderSettingsTabs(orderedIds)
    res.json({ tabs })
  } catch (error) {
    console.error('Failed to reorder settings tabs.', error)
    res.status(500).json({ error: 'settings_tabs_reorder_failed' })
  }
})

// PUT /api/settings/tabs/:tabId/sections — replace sections in a tab
settingsTabsRouter.put('/tabs/:tabId/sections', requireSuperAdmin, async (req, res) => {
  const tabId = req.params.tabId
  const sectionKeys = req.body?.sectionKeys

  if (!tabId) {
    res.status(400).json({ error: 'invalid_tab_id' })
    return
  }
  if (!Array.isArray(sectionKeys) || sectionKeys.some((k: unknown) => typeof k !== 'string')) {
    res.status(400).json({ error: 'section_keys_array_required' })
    return
  }

  try {
    const sections = await updateTabSections(tabId, sectionKeys)
    // Return full tabs for verification
    const tabs = await listSettingsTabs()
    res.json({ sections, tabs })
  } catch (error) {
    console.error('Failed to update tab sections.', error)
    res.status(500).json({ error: 'tab_sections_update_failed' })
  }
})
```

### 3.2 Register routes

**File:** `docu-library-pro-copy/server/index.ts`

Add import and mount:

```tsx
import { settingsTabsRouter } from './routes/settings-tabs.js'
// ...existing code...
app.use('/api/settings', settingsTabsRouter)
```

This mounts the tabs routes alongside the existing `settingsRouter` under `/api/settings`.

---

## Phase 4 — Frontend Types

### 4.1 Extend types

**File:** `docu-library-pro-copy/src/types.ts`

```tsx
// New types for tabbed settings
export interface SettingsTab {
  id: string
  name: string
  slug: string
  sort_order: number
  visible_to: 'all' | 'super_admin'
  sections: SettingsTabSection[]
}

export interface SettingsTabSection {
  id: string
  tab_id: string
  section_key: string  // matches SettingsAccordionSection
  sort_order: number
}

// Keep existing SettingsAccordionSection union type as-is (no changes needed)
```

### 4.2 API response types

Add a new API function type in `App.tsx` or a shared types file:

```tsx
interface SettingsTabsResponse {
  tabs: SettingsTab[]
}
```

---

## Phase 5 — Frontend: Fetch & Render Tabbed Settings

### 5.1 Fetch tabs on settings page load

**File:** `docu-library-pro-copy/src/App.tsx`

When `activeView === 'settings'` (or the equivalent), fetch tabs from the API:

```tsx
const [settingsTabs, setSettingsTabs] = useState<SettingsTab[]>([])
const [activeSettingsTabId, setActiveSettingsTabId] = useState<string>('')

useEffect(() => {
  if (activeView === 'settings') {
    fetch('/api/settings/tabs', { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        setSettingsTabs(data.tabs ?? [])
        // Select first tab by default
        if (data.tabs?.length > 0 && !activeSettingsTabId) {
          setActiveSettingsTabId(data.tabs[0].id)
        }
      })
      .catch(err => console.error('Failed to load settings tabs', err))
  }
}, [activeView])
```

### 5.2 Render tab bar

Replace the current accordion-only render with a tabbed layout:

```
┌─────────────────────────────────────────────────┐
│ [General] [Configuration] [Storage]  [+New Tab] [Edit Tab]│ ← Tab bar (Super Admin sees Private Add and Edit buttons)
├─────────────────────────────────────────────────┤
│ ┌─ appearance ────────────────────────── ▲ ▼ ─┐│
│ │  ...                                        ││
│ └──────────────────────────────────────────────┘│
│ ┌─ loginMode ─────────────────────────── ▲ ▼ ─┐│
│ │  ...                                        ││
│ └──────────────────────────────────────────────┘│
│ ┌─ manageUsers ───────────────────────── ▲ ▼ ─┐│
│ │  ...                                        ││
│ └──────────────────────────────────────────────┘│
└─────────────────────────────────────────────────┘
```

### 5.3 Render sections for active tab

Filter sections by `activeSettingsTabId`, then render them in the order specified by `sort_order`:

```tsx
const activeTab = settingsTabs.find(t => t.id === activeSettingsTabId)
const activeSections = activeTab?.sections ?? []

// Render each section using existing renderSettingsAccordionSection()
// but with DnD context wrapping the tab content area
```

### 5.4 Drag-and-drop between tabs

Use `@dnd-kit/core` for cross-container drag-and-drop:

1. **Tabs act as droppable containers** — each tab panel is a `useDroppable` target.
2. **Sections act as draggable items** — each accordion section is a `useDraggable` item.
3. **On drag end**, determine the source tab and destination tab. If the section moved to a different tab, rebuild both tabs' section lists and persist via `PUT /api/settings/tabs/:tabId/sections`.
4. **Within-tab reordering** uses `@dnd-kit/sortable` `SortableContext` with vertical list strategy.

### 5.5 Persist after drag-and-drop

After any drag operation:

```tsx
const handleDragEnd = async (event: DragEndEvent) => {
  const { active, over } = event
  if (!over) return

  const sourceTabId = findTabContainingSection(active.id)
  const destTabId = over.data.current?.tabId ?? sourceTabId

  // Rebuild section lists for affected tabs
  const updatedSourceSections = /* remove section from source */
  const updatedDestSections = /* insert section into dest at correct position */

  // Persist both tabs
  await fetch(`/api/settings/tabs/${destTabId}/sections`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ sectionKeys: updatedDestSections.map(s => s.section_key) }),
  })

  if (sourceTabId !== destTabId) {
    await fetch(`/api/settings/tabs/${sourceTabId}/sections`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ sectionKeys: updatedSourceSections.map(s => s.section_key) }),
    })
  }

  // Refresh full tab state from server for verification
  const res = await fetch('/api/settings/tabs', { credentials: 'include' })
  const data = await res.json()
  setSettingsTabs(data.tabs)
}
```

### 5.6 Manage Tabs UI (Super Admin only)

Add a "Manage Tabs" button visible only to Super Admins within the settings area. This opens a modal/page that allows:

1. **Create tab**: Form with name, slug (auto-generated from name), visibility dropdown.
2. **Edit tab**: Inline or modal edit of name and visibility.
3. **Delete tab**: Confirmation dialog — sections in deleted tab become unassigned (or moved to General).
4. **Reorder tabs**: Drag-and-drop the tab bar itself (persisted via `PUT /api/settings/tabs/reorder`).


---

## Phase 7 — Files to Touch (Checklist)

### Server

| File | Work |
| --- | --- |
| `docu-library-pro-copy/server/db.ts` | Add `settings_tabs` and `settings_tab_sections` to `SCHEMA_STATEMENTS`; add `seedSettingsTabs()` call in `initDb` |
| `docu-library-pro-copy/server/settings-tabs.ts` | **New file**: Types, CRUD functions, seeding logic |
| `docu-library-pro-copy/server/routes/settings-tabs.ts` | **New file**: Express router with all REST endpoints |
| `docu-library-pro-copy/server/index.ts` | Import and mount `settingsTabsRouter` at `/api/settings` |

### Client

| File | Work |
| --- | --- |
| `docu-library-pro-copyo/src/types.ts` | Add `SettingsTab`, `SettingsTabSection` interfaces |
| `docu-library-pro-copy/src/App.tsx` | Replace flat accordion with tabbed layout; add fetch logic, DnD handlers, Manage Tabs UI; remove `SUPER_ADMIN_ONLY_SECTIONS` |
| `docu-library-pro-copy/package.json` | Add `@dnd-kit/core` and `@dnd-kit/sortable` if not already present |

---

## Phase 8 — Implementation Order

1. **Database schema** — Add `settings_tabs` and `settings_tab_sections` to `SCHEMA_STATEMENTS`; wire `seedSettingsTabs()` into `initDb`.
2. **Server data layer** — Create `server/settings-tabs.ts` with all CRUD functions.
3. **API routes** — Create `server/routes/settings-tabs.ts` and mount in `server/index.ts`.
4. **API verification** — Use curl/Postman to verify all endpoints (GET, POST, PATCH, DELETE, PUT reorder, PUT sections). Confirm persistence via GET.
5. **Frontend types** — Add `SettingsTab`/`SettingsTabSection` to `src/types.ts`.
6. **Frontend fetch + render** — Add tab bar + tab panel rendering in `App.tsx`. Fetch tabs on settings view. Replace singleton accordion with tab-filtered sections.
7. **Drag-and-drop** — Install `@dnd-kit`, implement cross-tab drag-and-drop and within-tab sorting. Wire persistence calls.
8. **Manage Tabs UI** — Add Super Admin-only modal for create/edit/delete/reorder tabs.
10. **Manual QA** — Full test matrix below.

---

## Phase 9 — Verification / QA

### API Verification Checklist

After each server change, verify via curl or browser fetch:

| Step | API Call | Expected Result |
| --- | --- | --- |
| 1 | `GET /api/settings/tabs` (as Super Admin) | Returns 4 tabs with their sections |
| 2 | `GET /api/settings/tabs` (as Admin) | Returns 3 tabs (Private excluded); no sections with `visible_to: super_admin` |
| 3 | `POST /api/settings/tabs` `{ name: "Integrations", slug: "integrations", visible_to: "all" }` | Returns new tab with empty sections; GET confirms 5 tabs |
| 4 | `PATCH /api/settings/tabs/:id` `{ name: "Integrations v2" }` | Returns updated tab; GET confirms name change |
| 5 | `PUT /api/settings/tabs/:tabId/sections` `{ sectionKeys: ["appearance", "email"] }` | Returns updated sections; GET confirms sections moved |
| 6 | `PUT /api/settings/tabs/reorder` `{ orderedIds: [...] }` | Returns reordered tabs; GET confirms order |
| 7 | `DELETE /api/settings/tabs/:id` | Returns `{ deleted: true, tabs: [...] }`; GET confirms removal |
| 8 | `POST /api/settings/tabs` (as Admin) | Returns `403 super_admin_required` |
| 9 | `PATCH /api/settings/tabs/:id` (as Admin) | Returns `403 super_admin_required` |
| 10 | `DELETE /api/settings/tabs/:id` (as Admin) | Returns `403 super_admin_required` |

### Database Verification

| Check | Method |
| --- | --- |
| Tables created | Query `SELECT name FROM sqlite_master WHERE type='table' AND name IN ('settings_tabs', 'settings_tab_sections')` |
| Seed data present | After fresh init, `SELECT COUNT(*) FROM settings_tabs` returns 4 |
| Sections assigned | `SELECT tab_id, COUNT(*) FROM settings_tab_sections GROUP BY tab_id` — all 16 sections accounted for across all tabs |
| Slug uniqueness | `INSERT` with duplicate slug should fail (UNIQUE constraint) |
| Cascade delete | Delete a tab → its sections are removed (verify via `SELECT`) |
| Sort order updates | Update `sort_order` → `SELECT * FROM settings_tabs ORDER BY sort_order` returns correct order |

### UI Verification

| Scenario | Expected Behavior |
| --- | --- |
| Super Admin loads Settings | Sees all 4 tabs; Private tab visible; Manage Tabs button visible |
| Admin loads Settings | Sees 3 tabs (General, Configuration, Storage); Private tab hidden; no Manage Tabs button |
| Drag section within a tab | Section reorders; refresh page → order persists (confirmed via API) |
| Drag section to a different tab | Section moves; both source and destination tabs update; refresh persists |
| Create new tab | New tab appears in tab bar; sections can be dragged into it |
| Edit tab name | Tab name updates in real-time; refresh persists |
| Change tab visibility to super_admin | Tab disappears for Admin users; still visible to Super Admin |
| Delete tab | Tab removed; its sections become unassigned (or reassigned to General) |
| Reorder tabs | Drag tab in tab bar → order persists after refresh |

---

## Phase 10 — Rollback Plan

If the tabbed interface needs to be reverted:

1. **Server**: Keep the tables (they are additive and don't break existing functionality).
2. **Client**: Restore the flat accordion render from git history. The `SUPER_ADMIN_ONLY_SECTIONS` removal can be reverted.
3. **No data loss**: The existing settings sections and their functionality are untouched — only the presentation layer changes.

---

## Open Questions

1. **What happens to sections when a tab is deleted?**
    
    Answer: Unassigned sections auto-move to the "General" tab.
    
2. **Should the "General" tab be undeletable?**
    
    Answer: Yes — prevent deletion of the General tab since unassigned sections need a home.
    
3. **Can sections exist in multiple tabs?**
    
    Answer: No. The `UNIQUE(tab_id, section_key)` constraint prevents this. A section can only belong to one tab at a time.
    
4. **Should tabs have icons?**
    
    Answer: No. Out of scope for v1. Tab names are sufficient.
    
5. **Should the tab state persist per-user or globally?**
    
    Answer: Globally. Tab structure (which sections are in which tabs) is **global** — all users see the same organization. The `visible_to` field handles per-role filtering. Individual accordion open/close state remains per-user in localStorage (unchanged).
    

---

## Out of Scope (v1)

- Per-user tab customization (everyone sees the same tab layout)
- Tab icons or emoji
- Nested tabs
- Tab drag-and-drop for Admins (only Super Admin can rearrange)
- Lazy-loading sections (all section content renders in-page as today)
- Internationalization of default tab names

---

## Success Criteria

- [ ]  `settings_tabs` and `settings_tab_sections` tables created and seeded with 4 default tabs.
- [ ]  All existing settings sections are assigned to one of the 4 tabs.
- [ ]  Super Admins can create, edit, reorder, and delete tabs via UI.
- [ ]  Tabs respect `visible_to`: Private tabs hidden from Admins, visible to Super Admins.
- [ ]  Sections are draggable within a tab and between tabs (drag-and-drop).
- [ ]  All tab/section changes are persisted to the database and verifiable via API GET.
- [ ]  Admin users only see `visible_to: 'all'` tabs and cannot manage tabs.
- [ ]  All existing settings functionality (save, toggle, form validation) works within the tabbed layout.