# Toggle Style Plan — Current CSS vs. Style Guide CSS

## Overview

Add a toggle in **Settings > Branding** that switches the entire application between:

- **Current CSS** (`src/index.css`): Blue-primary design system using HSL custom properties (`--primary: 225 73% 57%`).
- **Style Guide CSS** (`docs/plans/css-style-guide.md`): Slate/blue palette with flat aesthetic, matching the SOP Knowledge Base prototypes.

The toggle persists to the database (`app_settings` table) and applies immediately via a CSS class on `<html>` or `<body>`. No page reload required.

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│  Settings > BrandingManagement.jsx              │
│  ┌───────────────────────────────────────┐      │
│  │  Style Theme: [Current ▼] [Style Guide]│      │
│  │  (Toggle / dropdown / radio group)    │      │
│  └───────────────────────────────────────┘      │
│  Saves via PUT /api/settings/app_style_theme    │
├─────────────────────────────────────────────────┤
│  BrandingContext.jsx                            │
│  - Exposes `styleTheme` ('current' | 'guide')  │
│  - Applies `data-style-theme` attribute on      │
│    <html> element on load & on change           │
├─────────────────────────────────────────────────┤
│  src/index.css (or new src/styles/guide.css)    │
│  - Scoped under [data-style-theme="guide"]      │
│  - Overrides CSS custom properties for colors,  │
│    border-radius, typography, spacing           │
├─────────────────────────────────────────────────┤
│  Backend: server/routes/settings.js             │
│  - Add 'app_style_theme' to ALLOWED_KEYS        │
│  - Default: 'current'                           │
└─────────────────────────────────────────────────┘
```

---

## Detailed Steps

### Step 1 — Backend: Add `app_style_theme` setting key

**File:** `server/routes/settings.js`

- Add `'app_style_theme'` to `ALLOWED_KEYS`.
- Add default in `DEFAULTS`: `app_style_theme: 'current'`.
- Add validation: must be `'current'` or `'guide'`.
- No new route needed — existing GET/PUT `/api/settings/:key` handles it.

### Step 2 — Frontend API: Add `app_style_theme` to branding fetch

**File:** `src/api/settings.js`

- Extend `fetchAppBranding()` to also fetch `app_style_theme`:
  ```js
  const styleTheme = await getPublicSetting('app_style_theme');
  ```
- Return `styleTheme: styleTheme || 'current'` in the result object.

### Step 3 — BrandingContext: Expose `styleTheme` and apply to DOM

**File:** `src/lib/BrandingContext.jsx`

- Add `styleTheme` state (default `'current'`).
- In `refreshBranding()`, set `styleTheme` from the fetched value.
- Add a `useEffect` that sets `document.documentElement.dataset.styleTheme = styleTheme` whenever it changes.
- Expose `styleTheme` in the context value.

### Step 4 — CSS: Create style guide theme overrides

**New File:** `src/styles/guide-theme.css`

This file contains all CSS custom property overrides scoped under `[data-style-theme="guide"]`. It maps the style guide's design tokens onto the app's existing CSS variable names so all components pick up the new theme automatically.

**Key mappings from style guide → CSS custom properties:**

| CSS Variable | Current Value | Guide Value |
|---|---|---|
| `--background` | `0 0% 98%` | `210 40% 96%` (slate-100) |
| `--foreground` | `222 14% 13%` | `217 33% 17%` (slate-800) |
| `--card` | `0 0% 100%` | `0 0% 100%` (white) |
| `--primary` | `225 73% 57%` | `221 83% 53%` (blue-600) |
| `--primary-foreground` | `0 0% 100%` | `0 0% 100%` |
| `--secondary` | `210 20% 96%` | `210 40% 96%` (slate-100) |
| `--muted` | `210 20% 96%` | `210 40% 96%` (slate-100) |
| `--muted-foreground` | `215 13% 44%` | `215 16% 47%` (slate-500) |
| `--accent` | `210 20% 94%` | `210 40% 96%` (slate-100) |
| `--border` | `214 18% 90%` | `214 32% 91%` (slate-200) |
| `--input` | `214 18% 90%` | `214 32% 91%` (slate-200) |
| `--ring` | `225 73% 57%` | `221 83% 53%` (blue-600) |
| `--destructive` | `0 72% 59%` | `0 84% 60%` (red-500) |
| `--sidebar-background` | `0 0% 100%` | `222 47% 11%` (slate-900) |
| `--sidebar-foreground` | `222 14% 13%` | `215 16% 65%` (slate-400) |
| `--sidebar-primary` | `225 73% 57%` | `198 93% 60%` (sky-400) |
| `--sidebar-accent` | `210 20% 96%` | `217 33% 17%` (slate-800) |
| `--sidebar-accent-foreground` | `222 14% 13%` | `210 40% 96%` |
| `--sidebar-border` | `214 18% 90%` | `217 33% 17%` (slate-800) |

**Additional style guide specifics to include:**
- `--radius: 2px` (same — no change)
- `--font-heading` / `--font-body`: `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif` (no Inter/JetBrains Mono)
- Typography scale adjustments (see style guide typography table)
- Status color variables for badges
- Procedure type color variables

**File:** `src/index.css`

- Import the new guide theme CSS at the end (or conditionally via JS).
- Wrap the import: ideally this is a regular CSS import that's always loaded but gated by the `[data-style-theme="guide"]` selector, so it only applies when active.

### Step 5 — Settings UI: Add style theme toggle

**File:** `src/pages/settings/BrandingManagement.jsx`

- Import `useBranding` to get `styleTheme` and `refreshBranding`.
- Add a new section below the existing branding fields:

```jsx
{/* Style Theme */}
<div className="space-y-1.5 pt-4 border-t border-border">
  <label className="field-label block">Style Theme</label>
  <p className="text-xs text-muted-foreground">
    Switch between the current blue theme and the slate-based style guide theme.
  </p>
  <div className="flex gap-3 pt-1">
    <label className="flex items-center gap-2 cursor-pointer">
      <input
        type="radio"
        name="style_theme"
        value="current"
        checked={styleThemeDraft === 'current'}
        onChange={() => setStyleThemeDraft('current')}
        className="accent-primary"
      />
      <span className="text-sm">Current (Blue)</span>
    </label>
    <label className="flex items-center gap-2 cursor-pointer">
      <input
        type="radio"
        name="style_theme"
        value="guide"
        checked={styleThemeDraft === 'guide'}
        onChange={() => setStyleThemeDraft('guide')}
        className="accent-primary"
      />
      <span className="text-sm">Style Guide (Slate)</span>
    </label>
  </div>
</div>
```

- Add `styleThemeDraft` state, initialized from context.
- Include `updateSetting('app_style_theme', styleThemeDraft)` in the `handleSave` Promise.all.
- Track `hasChanges` to include `styleThemeDraft !== styleTheme`.

### Step 6 — Dark mode compatibility

Both themes must work with the existing dark mode toggle. The guide theme CSS should also define `[data-style-theme="guide"] .dark { ... }` overrides for dark mode.

**Dark mode guide values:**

| CSS Variable | Guide Dark Value |
|---|---|
| `--background` | `222 47% 11%` (slate-900) |
| `--foreground` | `210 40% 96%` (slate-100) |
| `--card` | `217 33% 17%` (slate-800) |
| `--border` | `217 33% 17%` (slate-800) |
| `--input` | `217 33% 17%` (slate-800) |
| `--sidebar-background` | `222 47% 11%` (slate-900) |
| `--sidebar-border` | `217 33% 17%` (slate-800) |

### Step 7 — Edge Cases & Polish

- **Default behavior**: New installs default to `'current'` — no visual change until admin explicitly switches.
- **Guest users**: Theme applies to all pages (login, public) since it's a global setting fetched via public API.
- **Toggle is instant**: The `data-style-theme` attribute on `<html>` changes immediately on save; CSS responds without page reload.
- **Reset**: If `app_style_theme` is deleted or set to an unknown value, fall back to `'current'`.
- **Migration**: No database migration needed — the key/value `app_settings` table handles new keys automatically.
- **Per-org vs global**: This is a global app setting (same as logo/title), not per-organization.

---

## Files Changed / Created

| Action | File | Description |
|--------|------|-------------|
| Modify | `server/routes/settings.js` | Add `app_style_theme` to ALLOWED_KEYS + DEFAULTS + validation |
| Modify | `src/api/settings.js` | Add `app_style_theme` to `fetchAppBranding()` |
| Modify | `src/lib/BrandingContext.jsx` | Add `styleTheme` state, DOM attribute application, expose in context |
| **Create** | `src/styles/guide-theme.css` | All CSS custom property overrides scoped to `[data-style-theme="guide"]` |
| Modify | `src/index.css` | Import `guide-theme.css` |
| Modify | `src/pages/settings/BrandingManagement.jsx` | Add radio toggle for style theme |

---

## Testing Checklist

- [ ] Admin switches to "Style Guide" → entire app changes to slate/blue palette.
- [ ] Admin switches back to "Current" → app reverts to blue-primary theme.
- [ ] Dark mode toggle works correctly under both themes.
- [ ] Login page reflects the selected theme.
- [ ] Sidebar colors change per theme (dark sidebar in guide mode, light in current).
- [ ] Buttons, inputs, cards, badges all pick up correct colors.
- [ ] Typography changes (system font stack instead of Inter/JetBrains Mono) in guide mode.
- [ ] Border radius remains 2px in both themes.
- [ ] Setting persists across page reloads and new sessions.
- [ ] Guest users see the correct theme on public pages.
- [ ] No visual regressions in current theme when toggle is not touched.
