# Application Branding Plan

## Overview
Allow Org Admins to set a custom **Application Logo** (SVG/PNG URL) and **Application Title** via the Settings page. The logo renders in the upper‑left corner of the header; the title renders immediately to its right. If no custom branding is configured, the current hardcoded logo (BookOpen icon) and title ("KBB Pro") remain as defaults.

## Architecture

```
┌──────────────────────────────────────────────────┐
│  AppLayout.jsx  (reads branding from context)    │
│  ┌─────────┐  ┌───────────────┐                  │
│  │ Logo    │  │ App Title     │  ...header nav   │
│  └─────────┘  └───────────────┘                  │
├──────────────────────────────────────────────────┤
│  BrandingContext  (React Context + hook)         │
│  - fetch from /api/settings/:key                  │
│  - cache in state; re-fetch on settings save     │
├──────────────────────────────────────────────────┤
│  Settings → BrandingManagement.jsx (new)         │
│  - Logo URL input (validates URL or base64)      │
│  - Title text input                               │
│  - Saves via PUT /api/settings/:key               │
├──────────────────────────────────────────────────┤
│  Backend: server/routes/settings.js               │
│  - Add 'app_logo_url' & 'app_title' to ALLOWED_KEYS│
│  - Store in app_settings table (key/value)        │
└──────────────────────────────────────────────────┘
```

## Detailed Steps

### Step 1 — Backend: Extend settings API
**File:** `server/routes/settings.js`
- Add `'app_logo_url'` and `'app_title'` to `ALLOWED_KEYS`.
- Add sensible defaults:
  - `app_logo_url`: `''` (empty = use default icon)
  - `app_title`: `'KBB Pro'`
- Add optional validation for `app_logo_url`:
  - Must be a valid URL (http/https) or a data URI (`data:image/svg+xml;base64,...` or `data:image/png;base64,...`), or empty.
  - If a URL, optionally verify it points to an image resource (basic content-type check or just trust the URL).
- The existing generic key/value GET/PUT flow handles storage — no new routes needed.

### Step 2 — Frontend API: Extend settings client
**File:** `src/api/settings.js`
- Ensure `getSetting(key)` and `setSetting(key, value)` functions exist (or add them if not).
- These functions call `GET /api/settings/:key` and `PUT /api/settings/:key` with the auth token.
- Add `fetchAppBranding()` convenience function that fetches both keys in parallel.

### Step 3 — Branding Context Provider
**New File:** `src/lib/BrandingContext.jsx`
- React Context that holds `{ logoUrl, title, loading }`.
- On mount, fetches `app_logo_url` and `app_title` from the API.
- Exposes a `refreshBranding()` function so the settings page can trigger a re-fetch after saving.
- Wrap the app (or `AppLayout`) with `<BrandingProvider>`.

**File:** `src/App.jsx`
- Import and wrap with `<BrandingProvider>` inside the existing provider hierarchy (likely inside `<AuthProvider>` / `<QueryClientProvider>`).

### Step 4 — Settings UI: Branding section
**New File:** `src/pages/settings/BrandingManagement.jsx`
- Present two inputs:
  1. **Logo URL**: text input + live preview thumbnail (shows the image if URL is valid, or a broken placeholder if invalid).
     - Accept SVG and PNG URLs (http/https or data URIs).
     - Show validation feedback inline (green check / red error).
  2. **App Title**: text input, max ~60 characters.
- "Save" button calls `setSetting('app_logo_url', value)` and `setSetting('app_title', value)`, then calls `refreshBranding()`.
- Follows the same card-based UI pattern as other settings components (e.g., `FieldManagement`).

**File:** `src/pages/Settings.jsx`
- Import `BrandingManagement` and a relevant icon (e.g., `Palette` or `Globe` from lucide-react).
- Add a new entry to the `sections` array:
  ```js
  { key: 'branding', label: 'Branding', icon: Palette, Component: BrandingManagement }
  ```

### Step 5 — Header: Render dynamic branding
**File:** `src/components/layout/AppLayout.jsx`
- Import and use the Branding context (`useBranding()` hook).
- Replace the hardcoded logo area (lines 50–55) with dynamic rendering:
  ```jsx
  const { logoUrl, title } = useBranding();

  // In the header
  <Link to="/" className="flex items-center gap-2 shrink-0">
    {logoUrl ? (
      <img src={logoUrl} alt={title} className="h-7 w-auto max-w-[120px] object-contain" />
    ) : (
      <div className="w-7 h-7 bg-primary flex items-center justify-center" style={{ borderRadius: 2 }}>
        <BookOpen className="w-4 h-4 text-primary-foreground" />
      </div>
    )}
    <span className="font-semibold text-sm hidden sm:block">{title || 'KBB Pro'}</span>
  </Link>
  ```
- Ensure fallback to default icon/title when branding is unset or fails to load.
- Handle `onError` on the `<img>` tag to fall back to the default icon if the URL is unreachable.

### Step 6 — Edge Cases & Polish
- **Empty/cleared fields**: If the admin clears both fields and saves, the app reverts to defaults (BookOpen icon + "KBB Pro").
- **Broken image URL**: `onError` handler on `<img>` hides the broken image and shows the default icon.
- **Guest users**: Branding still renders because it's global (not user-specific). The branding API endpoints should be publicly readable (GET) but admin-only for writes (PUT). The existing settings route already handles this — GET is public, PUT requires `authenticateToken` + `requireAdmin`.
- **CORS / external images**: If `app_logo_url` points to an external domain, the browser will load it naturally via `<img>`. No server-side proxying needed.
- **Responsive design**: The logo image uses `max-w-[120px]` and `object-contain` to prevent overflow on small screens.
- **Dark mode**: If using an SVG logo, ensure it renders well on both light and dark backgrounds. Optionally add a `dark_logo_url` field later, but keep it simple for now.

## Files Changed / Created

| Action | File | Description |
|--------|------|-------------|
| Modify | `server/routes/settings.js` | Add `app_logo_url` & `app_title` keys |
| Modify | `src/api/settings.js` | Add branding fetch/set helpers |
| **Create** | `src/lib/BrandingContext.jsx` | React context for branding state |
| Modify | `src/App.jsx` | Wrap with `<BrandingProvider>` |
| **Create** | `src/pages/settings/BrandingManagement.jsx` | Settings UI component |
| Modify | `src/pages/Settings.jsx` | Add Branding section to settings list |
| Modify | `src/components/layout/AppLayout.jsx` | Dynamic logo + title in header |

## Testing Checklist
- [ ] Admin saves a valid PNG URL → logo appears in header, title updates.
- [ ] Admin saves an SVG data URI → logo appears in header.
- [ ] Admin clears both fields → defaults restore (BookOpen + "KBB Pro").
- [ ] Invalid URL → validation error shown inline; setting not saved.
- [ ] Guest user sees the branded header on public pages.
- [ ] Logo image fails to load (404) → falls back to default icon.
- [ ] Mobile viewport → logo scales correctly, title hidden (sm:block).
- [ ] Dark mode toggle → branding persists across mode switches.