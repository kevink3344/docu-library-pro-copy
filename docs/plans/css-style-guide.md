# CSS / Tailwind Style Guide

Reusable design system extracted from the SOP Knowledge Base prototypes. Designed for **mobile-first**, **flat aesthetic** (`border-radius: 2px`), and **Tailwind CSS 3** compatibility.

---

## Design Tokens

### Color Palette

| Token | Hex | Tailwind | Usage |
|-------|-----|----------|-------|
| Page Background | `#f1f5f9` | `slate-100` | Body / main background |
| Card Background | `#ffffff` | `white` | Cards, modals, dropdowns |
| Card Border | `#e2e8f0` | `slate-200` | Card borders, dividers |
| Row Hover | `#f8fafc` | `slate-50` | Table row hover, item hover |
| Row Stripe | `#f1f5f9` | `slate-100` | Table row borders |
| Sidebar BG | `#0f172a` | `slate-900` | Sidebar background |
| Sidebar Hover | `#1e293b` | `slate-800` | Sidebar item hover |
| Sidebar Text | `#94a3b8` | `slate-400` | Sidebar nav items |
| Sidebar Active | `#38bdf8` | `sky-400` | Active nav item accent |
| Primary | `#2563eb` | `blue-600` | Buttons, links, accents |
| Primary Hover | `#1d4ed8` | `blue-700` | Button hover |
| Success | `#16a34a` | `green-600` | Approved status, success |
| Warning | `#d97706` | `amber-600` | Review status, pending |
| Danger | `#ef4444` | `red-500` | Rejected, delete, sign out |
| Text Primary | `#1e293b` | `slate-800` | Headings, body text |
| Text Secondary | `#475569` | `slate-600` | Descriptions, metadata |
| Text Muted | `#64748b` | `slate-500` | Labels, secondary info |
| Text Subtle | `#94a3b8` | `slate-400` | Timestamps, placeholders |

### Status Colors

| Status | Background | Text |
|--------|-----------|------|
| Draft | `#f1f5f9` (slate-100) | `#475569` (slate-600) |
| In Review | `#fef3c7` (amber-100) | `#92400e` (amber-800) |
| Approved | `#dcfce7` (green-100) | `#166534` (green-800) |
| Archived | `#fee2e2` (red-100) | `#991b1b` (red-800) |

### Procedure Type Colors

| Type | Background | Text |
|------|-----------|------|
| SOP | `#dbeafe` (blue-100) | `#1e40af` (blue-800) |
| Policy | `#fef3c7` (amber-100) | `#92400e` (amber-800) |
| Guideline | `#ede9fe` (violet-100) | `#5b21b6` (violet-800) |
| Work Instruction | `#dcfce7` (green-100) | `#166534` (green-800) |

### Stat Icon Colors

| Variant | Background | Icon Color |
|---------|-----------|------------|
| Blue | `#dbeafe` (blue-100) | `#2563eb` (blue-600) |
| Green | `#dcfce7` (green-100) | `#16a34a` (green-600) |
| Amber | `#fef3c7` (amber-100) | `#d97706` (amber-600) |
| Purple | `#ede9fe` (violet-100) | `#7c3aed` (violet-600) |

---

## Typography

```css
font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
```

| Element | Size | Weight | Tailwind |
|---------|------|--------|----------|
| Page Title (h1) | 20px / 22px (desktop) | 600 | `text-xl font-semibold lg:text-2xl` |
| Card Title (h3) | 15px / 16px (desktop) | 600 | `text-base font-semibold` |
| Section Header | 11px | 600 | `text-xs font-semibold uppercase tracking-wider` |
| Body Text | 13px / 14px (desktop) | 400 | `text-sm` |
| Small / Meta | 11px–12px | 400 | `text-xs` |
| Stat Value | 24px / 28px (desktop) | 700 | `text-2xl font-bold lg:text-3xl` |
| Button Text | 13px / 14px (desktop) | 500 | `text-sm font-medium` |

---

## Border Radius

**Global rule: `border-radius: 2px`** for all components.

Exceptions (keep circular):
- Avatars: `border-radius: 50%`
- Activity dots: `border-radius: 50%`
- Notification badge dot: `border-radius: 50%`
- Stage indicator dots: `border-radius: 50%`
- Stage icons (approval workflow): `border-radius: 50%`

Tailwind equivalent: `rounded-sm` (2px) for most things, `rounded-full` for circular elements.

---

## Spacing

| Context | Mobile | Desktop | Tailwind |
|---------|--------|---------|----------|
| Page padding | 16px | 24px | `p-4 lg:p-6` |
| Card padding | 14–16px | 20px | `p-4 lg:p-5` |
| Table cell padding | 12px 14px | 14px 20px | `px-3.5 py-3 lg:px-5 lg:py-3.5` |
| Header padding | 12px 16px | 14px 24px | `px-4 py-3 lg:px-6 lg:py-3.5` |
| Grid gap (mobile) | 12–16px | 20px | `gap-3 lg:gap-5` |
| Button padding | 7–8px 12–14px | 8px 16px | `px-3.5 py-2 lg:px-4 lg:py-2` |

---

## Components

### Buttons

```css
.btn {
  padding: 8px 14px;
  border-radius: 2px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  border: none;
  display: flex;
  align-items: center;
  gap: 6px;
}
```

| Variant | CSS | Tailwind |
|---------|-----|----------|
| Primary | `background: #2563eb; color: #fff;` | `bg-blue-600 text-white` |
| Primary Hover | `background: #1d4ed8;` | `hover:bg-blue-700` |
| Success | `background: #16a34a; color: #fff;` | `bg-green-600 text-white` |
| Danger | `background: #ef4444; color: #fff;` | `bg-red-500 text-white` |
| Outline | `background: #fff; color: #475569; border: 1px solid #e2e8f0;` | `bg-white text-slate-600 border border-slate-200` |
| Ghost | `background: none; color: #64748b;` | `text-slate-500` |

### Cards

```css
.card {
  background: #fff;
  border-radius: 2px;
  border: 1px solid #e2e8f0;
  overflow: hidden;
}
.card-header {
  padding: 14px 16px;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
```

Tailwind: `bg-white rounded-sm border border-slate-200 overflow-hidden`

### Stat Cards

```css
.stat-card {
  background: #fff;
  border-radius: 2px;
  padding: 16px;
  border: 1px solid #e2e8f0;
}
.stat-card .stat-icon {
  width: 36px; height: 36px;
  border-radius: 2px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.stat-card .stat-value { font-size: 24px; font-weight: 700; }
.stat-card .stat-label { font-size: 12px; color: #64748b; }
```

Tailwind: `bg-white rounded-sm border border-slate-200 p-4`

### Status Badges

```css
.status {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 2px;
  font-size: 11px;
  font-weight: 500;
}
```

Tailwind: `inline-block rounded-sm px-2 py-0.5 text-xs font-medium`

### Procedure Type Badges

```css
.proc-type {
  display: inline-block;
  padding: 2px 6px;
  border-radius: 2px;
  font-size: 10px;
  font-weight: 500;
}
```

Tailwind: `inline-block rounded-sm px-1.5 py-0.5 text-[10px] font-medium`

### Department Tags

```css
.dept-tag {
  display: inline-block;
  padding: 2px 6px;
  border-radius: 2px;
  font-size: 11px;
  background: #f1f5f9;
  color: #475569;
}
```

Tailwind: `inline-block rounded-sm px-1.5 py-0.5 text-xs bg-slate-100 text-slate-600`

### Form Inputs

```css
input, select, textarea {
  padding: 7px 10px;
  border: 1px solid #e2e8f0;
  border-radius: 2px;
  font-size: 12px;
  color: #1e293b;
  background: #fff;
  outline: none;
}
input:focus, select:focus, textarea:focus {
  border-color: #2563eb;
}
```

Tailwind: `rounded-sm border border-slate-200 px-2.5 py-1.5 text-xs focus:border-blue-600 focus:ring-0 outline-none`

### Search Box

```css
.search-box {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  border-radius: 2px;
  padding: 6px 12px;
}
.search-box input {
  border: none; background: none; outline: none;
  font-size: 13px;
}
```

Tailwind: `flex items-center gap-2 bg-slate-100 border border-slate-200 rounded-sm px-3 py-1.5`

### Filter Chips

```css
.filter-chip {
  padding: 5px 10px;
  border-radius: 2px;
  font-size: 11px;
  border: 1px solid #e2e8f0;
  background: #fff;
  color: #475569;
}
.filter-chip.active {
  background: #2563eb;
  color: #fff;
  border-color: #2563eb;
}
```

Tailwind: `rounded-sm border border-slate-200 px-2.5 py-1 text-xs`
Active: `bg-blue-600 text-white border-blue-600`

---

## Layout

### App Shell

```
┌──────────┬──────────────────────────────────────┐
│          │  ☰ Page Title    [Org ▼]   🔔 ☀ 👤 JD │
│ Sidebar  │──────────────────────────────────────│
│          │                                      │
│ 240px    │  Content Area                        │
│          │                                      │
└──────────┴──────────────────────────────────────┘
```

- Sidebar: fixed off-canvas on mobile (`< 768px`), static on desktop
- Header: full-width, flexbox, wraps on small screens
- Content: scrollable, padded

### Responsive Breakpoints

| Breakpoint | Width | Behavior |
|-----------|-------|----------|
| Mobile (default) | < 768px | Sidebar hidden, toggle via hamburger. Single-column grids. |
| Tablet / Desktop | ≥ 768px | Sidebar visible. Multi-column grids. Search box visible. |

```css
/* Mobile-first base styles */
.stats-grid { grid-template-columns: repeat(2, 1fr); }
.two-col { grid-template-columns: 1fr; }

/* Desktop overrides */
@media (min-width: 768px) {
  .stats-grid { grid-template-columns: repeat(4, 1fr); }
  .two-col { grid-template-columns: 1fr 1fr; }
}
```

### Sidebar

```css
.sidebar {
  position: fixed; top: 0; left: 0; bottom: 0;
  z-index: 100;
  width: 260px;
  background: #0f172a;
  color: #e2e8f0;
  transform: translateX(-100%);
  transition: transform 0.25s ease;
}
.sidebar.open { transform: translateX(0); }

.sidebar-overlay {
  display: none;
  position: fixed; inset: 0;
  z-index: 99;
  background: rgba(0,0,0,0.4);
}
.sidebar-overlay.show { display: block; }

@media (min-width: 768px) {
  .sidebar { position: static; transform: none; width: 240px; }
  .sidebar-overlay { display: none !important; }
}
```

### Stats Grid

Mobile: 2 columns → Desktop: 4 columns

```css
.stats-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}
@media (min-width: 768px) {
  .stats-grid { grid-template-columns: repeat(4, 1fr); gap: 20px; }
}
```

### Two-Column Layout

Mobile: stacked → Desktop: side-by-side

```css
.two-col {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
}
@media (min-width: 768px) {
  .two-col { grid-template-columns: 1fr 1fr; gap: 20px; }
}
```

---

## Header Bar Components

### Notification Icon

```css
.header-icon {
  position: relative;
  background: none;
  border: none;
  color: #475569;
  cursor: pointer;
  padding: 6px;
  border-radius: 2px;
  display: flex;
  align-items: center;
}
.header-icon:hover { background: #f1f5f9; color: #1e293b; }
.header-icon .notif-badge {
  position: absolute; top: 2px; right: 2px;
  width: 8px; height: 8px;
  border-radius: 50%;
  background: #ef4444;
  border: 2px solid #fff;
}
```

Lucide icon: `bell`

### Theme Toggle

Same `.header-icon` styles. Lucide icons: `sun` (light mode) / `moon` (dark mode).

### User Profile

```css
.user-profile {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 2px;
}
.user-profile:hover { background: #f1f5f9; }
.user-profile .profile-icon { color: #2563eb; }
.user-profile .profile-initials {
  font-weight: 600;
  font-size: 13px;
  color: #1e293b;
}
```

Lucide icon: `circle-user` (blue) + initials text.

### User Dropdown

```css
.user-dropdown {
  display: none;
  position: absolute; top: 42px; right: 0;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 2px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.12);
  min-width: 200px;
  z-index: 60;
}
.user-dropdown.show { display: block; }
.user-dropdown-header {
  padding: 12px 14px;
  border-bottom: 1px solid #f1f5f9;
}
.user-dropdown-item {
  display: flex; align-items: center; gap: 8px;
  padding: 10px 14px;
  font-size: 13px;
  color: #475569;
  cursor: pointer;
}
.user-dropdown-item:hover { background: #f8fafc; }
.user-dropdown-item.signout {
  color: #ef4444;
  border-top: 1px solid #f1f5f9;
}
```

---

## Approval Workflow

### Stage Indicators

```css
.stage-dot { width: 8px; height: 8px; border-radius: 50%; background: #e2e8f0; }
.stage-dot.completed { background: #16a34a; }
.stage-dot.current { background: #f59e0b; box-shadow: 0 0 0 3px rgba(245,158,11,0.2); }
.stage-dot.rejected { background: #ef4444; }
.stage-line { width: 18px; height: 2px; background: #e2e8f0; }
.stage-line.completed { background: #16a34a; }
```

### Stage Rows

```css
.stage-row {
  display: flex; align-items: center; gap: 10px;
  padding: 8px 12px;
  background: #f8fafc;
  border-radius: 2px;
  font-size: 12px;
}
.stage-row.current { background: #fffbeb; border: 1px solid #fde68a; }
.stage-row.approved { background: #f0fdf4; }
.stage-row.rejected { background: #fef2f2; }
```

### Stage Icons (circular)

```css
.stage-icon {
  width: 28px; height: 28px;
  border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
}
.stage-icon.pending { background: #f1f5f9; color: #94a3b8; }
.stage-icon.current { background: #fef3c7; color: #d97706; }
.stage-icon.approved { background: #dcfce7; color: #16a34a; }
.stage-icon.rejected { background: #fee2e2; color: #ef4444; }
```

---

## Editor Layout

```
┌──────────────────────┬──────────────────────┬───────────┐
│  Toolbar             │  Preview             │  Metadata │
│  [B][I][U] | H1 H2  │                      │  Org: ___ │
│  [list][ol][check]   │  Rendered Markdown   │  Type: __ │
│  [link][img][table]  │                      │  Dept: __ │
├──────────────────────┤                      │  Equip:   │
│                      │                      │  Software │
│  Markdown Source     │                      │  Tags     │
│  (textarea)          │                      │           │
│                      │                      │           │
└──────────────────────┴──────────────────────┴───────────┘
```

On mobile: editor and preview stack vertically, metadata moves below.

---

## AI Widget

```css
.ai-widget {
  position: fixed; bottom: 12px; right: 12px;
  width: calc(100vw - 24px); max-width: 360px;
  background: #fff;
  border-radius: 2px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.18);
  border: 1px solid #e2e8f0;
  overflow: hidden;
  z-index: 50;
}
.ai-widget-header {
  background: #0f172a; color: #fff;
  padding: 12px 16px;
  display: flex; align-items: center; justify-content: space-between;
  font-size: 13px; font-weight: 600;
}
.ai-suggestion {
  padding: 8px 12px; font-size: 12px; color: #475569;
  border-bottom: 1px solid #f1f5f9;
  cursor: pointer;
}
.ai-suggestion:hover { background: #f8fafc; }
```

Desktop: `bottom: 24px; right: 24px; width: 380px;`

---

## Pagination

```css
.pagination {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 16px;
  border-top: 1px solid #e2e8f0;
  font-size: 12px; color: #64748b;
}
.pagination-btns button {
  padding: 5px 10px;
  border: 1px solid #e2e8f0;
  border-radius: 2px;
  background: #fff;
  font-size: 12px; color: #475569;
}
.pagination-btns button.active {
  background: #2563eb; color: #fff; border-color: #2563eb;
}
```

---

## Search Results

```css
.result-card {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 2px;
  padding: 14px 16px;
  margin-bottom: 10px;
  cursor: pointer;
}
.result-card:hover { box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
.result-card .result-title {
  font-size: 15px; font-weight: 600; color: #2563eb;
}
.result-card .result-snippet mark {
  background: #fef3c7; color: #92400e;
  padding: 1px 3px;
  border-radius: 2px;
}
.relevance-bar { height: 3px; background: #e2e8f0; border-radius: 2px; }
.relevance-fill { height: 100%; background: #2563eb; border-radius: 2px; }
```

---

## Light/Dark Mode

Toggle via `dark` class on `<html>`:

```html
<html class="dark">
```

Use Tailwind's `dark:` variant for all components:

```css
/* Example: card in dark mode */
.dark .card { background: #1e293b; border-color: #334155; }
.dark .card-header { border-color: #334155; }
.dark body { background: #0f172a; color: #e2e8f0; }
.dark .header { background: #1e293b; border-color: #334155; }
```

Theme preference persisted in `localStorage` and defaults to `prefers-color-scheme`.

---

## Icon Set

All icons use **Lucide React** (or `lucide` via CDN for prototypes).

Common icons used:

| Context | Icon |
|---------|------|
| Logo / App | `book-open` |
| Dashboard | `layout-dashboard` |
| Procedures | `file-text` |
| Approvals | `check-circle` |
| Equipment | `wrench` |
| Software | `monitor` |
| Departments | `building-2` |
| Search | `search` |
| AI Assistant | `bot`, `sparkles` |
| Revision History | `history` |
| Notifications | `bell` |
| Theme Toggle | `sun` / `moon` |
| User Profile | `circle-user` |
| Sign Out | `log-out` |
| Settings | `user` |
| Hamburger Menu | `menu` |
| Close / Dismiss | `x` |
| Add / Create | `plus` |
| Save | `save` |
| Edit | `edit-3` |
| Delete | `trash-2` |
| View / Preview | `eye` |
| Submit / Send | `send` |
| Export / Download | `download` |
| Back | `arrow-left` |
| Version | `git-branch` |
| Clock / Time | `clock` |
| Users | `users` |
| Check (approved) | `check-circle`, `check-check` |
| Cross (rejected) | `x-circle` |
| Pending | `clock`, `circle` |
| Link | `link` |
| Image | `image` |
| Table | `table` |
| Code | `code-2` |
| List | `list`, `list-ordered` |
| Checklist | `check-square` |
| Diagram / Branch | `git-branch` |
| Chevron / Expand | `chevron-down`, `chevron-left`, `chevron-right` |
| More Options | `more-horizontal` |
| Minimize | `minimize-2` |
