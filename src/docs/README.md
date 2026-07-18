# KBB Pro — Documentation

> **KBB Pro** is a multi-organization Knowledge Base Builder application built on the Base44 platform using React, Tailwind CSS, and Base44's backend-as-a-service.

---

## Table of Contents

1. [Overview](#overview)
2. [Tech Stack](#tech-stack)
3. [Project Structure](#project-structure)
4. [Entities (Data Models)](#entities-data-models)
5. [Pages & Routes](#pages--routes)
6. [Components](#components)
7. [Context & State](#context--state)
8. [Backend Functions](#backend-functions)
9. [Authentication & Access Control](#authentication--access-control)
10. [Settings & Configuration](#settings--configuration)
11. [Notifications](#notifications)
12. [Design System](#design-system)

---

## Overview

KBB Pro allows organizations to manage internal knowledge base documents (policies, contracts, guides, etc.) with features including:

- **Multi-org support** — users can belong to and switch between multiple organizations.
- **Document management** — create, view, edit, and delete documents with metadata like tags, department, location, and renewal dates.
- **Custom fields** — org admins can define custom fields (text, select, multi-select) appended to every document.
- **Field layout customization** — drag-and-drop ordering of fields on the Add and View screens.
- **Team-based visibility** — documents can be restricted to specific teams.
- **Renewal tracking** — documents with expiry dates trigger visual warnings and automated email notifications.
- **In-app notifications** — renewal alerts surfaced via a notification bell in the header.
- **Role-based access** — Super Admins manage all orgs; Org Admins manage their org's settings; standard users read/write documents.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, React Router v6 |
| Styling | Tailwind CSS, shadcn/ui components |
| Icons | Lucide React |
| Data Fetching | TanStack React Query |
| Backend / DB | Base44 (entities, backend functions, integrations) |
| Auth | Base44 Auth (email/password + Google OAuth) |
| Date Utilities | date-fns |

---

## Project Structure

```
src/
├── api/
│   └── base44Client.js          # Pre-initialized Base44 SDK client
├── components/
│   ├── layout/
│   │   ├── AppLayout.jsx        # Top nav + sidebar shell
│   │   └── OrgSwitcher.jsx      # Dropdown to switch active organization
│   ├── documents/
│   │   ├── RenewBadge.jsx       # Visual badge for renewal status
│   │   ├── DocumentPreview.jsx  # Modal iframe document viewer
│   │   ├── TagInput.jsx         # Tag creation input
│   │   ├── MultiSelectInput.jsx # Multi-select button group
│   │   └── CustomFieldInput.jsx # Factory for custom field input types
│   ├── notifications/
│   │   └── NotificationBell.jsx # Header bell with unread count + dropdown
│   ├── AuthLayout.jsx           # Shared wrapper for auth pages
│   ├── GoogleIcon.jsx           # Google brand icon for OAuth button
│   ├── ProtectedRoute.jsx       # Auth guard for protected routes
│   ├── ScrollToTop.jsx          # Resets scroll on route changes
│   └── UserNotRegisteredError.jsx
├── lib/
│   ├── OrgContext.jsx           # Global organization context & helpers
│   ├── AuthContext.jsx          # Global auth state
│   ├── query-client.js          # TanStack QueryClient instance
│   ├── app-params.js
│   ├── utils.js
│   └── PageNotFound.jsx
├── pages/
│   ├── Login.jsx
│   ├── Register.jsx
│   ├── ForgotPassword.jsx
│   ├── ResetPassword.jsx
│   ├── Dashboard.jsx            # Main document list view
│   ├── DocumentForm.jsx         # Create / edit a document
│   ├── DocumentView.jsx         # Read-only document detail
│   └── settings/
│       ├── Settings.jsx              # Settings shell with collapsible sections
│       ├── FieldManagement.jsx       # Manage system & custom fields
│       ├── LayoutCustomization.jsx     # Drag-and-drop field ordering
│       ├── TeamManagement.jsx        # Create/edit teams & membership
│       ├── LocationManagement.jsx      # Manage sites/locations
│       ├── DepartmentManagement.jsx    # Manage departments
│       ├── MemberManagement.jsx        # Manage users
│       └── OrganizationManagement.jsx  # Super Admin org management
├── functions/
│   └── renewalNotifications.js  # Scheduled backend function for renewal emails
├── entities/                    # JSON schemas for Base44 entities
│   ├── Organization.json
│   ├── KBBDocument.json
│   ├── CustomField.json
│   ├── FieldConfig.json
│   ├── Team.json
│   ├── OrgMember.json
│   └── Notification.json
├── docs/
│   └── README.md                # ← You are here
├── App.jsx                      # Router definition
├── index.css                    # Design tokens + Tailwind base
└── tailwind.config.js
```

---

## Entities (Data Models)

### Organization
Represents a company/team workspace.

| Field | Type | Description |
|---|---|---|
| `name` | string | Organization display name |
| `description` | string | Optional description |
| `slug` | string | URL-friendly identifier |
| `admin_user_ids` | string[] | User IDs with Org Admin privileges |
| `is_active` | boolean | Whether the org is active |

---

### KBBDocument
A knowledge base item owned by an organization.

| Field | Type | Description |
|---|---|---|
| `org_id` | string | Parent organization |
| `title` | string | Document title |
| `description` | string | Summary / notes |
| `document_id` | string | Custom reference ID |
| `link_url` | string | External URL or Google Doc link |
| `file_url` | string | Original uploaded filename |
| `file_type` | string | `pdf`, `word`, `excel`, `google-doc`, `url` |
| `file_blob` | BLOB | Binary file content stored in Turso |
| `tags` | string[] | Free-text tags |
| `location` | string[] | Location labels |
| `department` | string[] | Department labels |
| `renew_date` | date | Renewal / expiry date (optional) |
| `renew_notified_30` | boolean | 30-day notification sent flag |
| `renew_notified_7` | boolean | 7-day notification sent flag |
| `visibility` | `everyone` \| `teams` | Access control |
| `allowed_team_ids` | string[] | Teams that can view (when visibility=teams) |
| `creator_user_id` | string | ID of the creating user |
| `custom_field_values` | object | Map of `custom_field_id → value` |

---

### CustomField
Org-defined metadata fields added to every document form.

| Field | Type | Description |
|---|---|---|
| `org_id` | string | Parent organization |
| `name` | string | Display label |
| `input_type` | enum | `text-short`, `text-paragraph`, `single-select`, `multi-select` |
| `options` | string[] | Values for select fields |
| `display_order` | number | Render order |
| `status` | `active` \| `inactive` | Whether the field is visible |

---

### FieldConfig
Stores per-org layout preferences for field ordering and visibility.

| Field | Type | Description |
|---|---|---|
| `org_id` | string | Parent organization |
| `hidden_required_fields` | string[] | System fields hidden for this org |
| `add_screen_order` | string[] | Field IDs in order for the Add screen |
| `view_screen_order` | string[] | Field IDs in order for the View screen |

---

### Team
A named group of users within an organization.

| Field | Type | Description |
|---|---|---|
| `org_id` | string | Parent organization |
| `name` | string | Team name |
| `description` | string | Optional description |
| `member_user_ids` | string[] | User IDs in this team |

---

### OrgMember
Tracks a user's role within a specific organization.

| Field | Type | Description |
|---|---|---|
| `org_id` | string | Organization |
| `user_id` | string | User |
| `role` | enum | `org_admin`, `team_member`, `standard_user` |

---

### Notification
In-app alert for renewal events.

| Field | Type | Description |
|---|---|---|
| `user_id` | string | Recipient user |
| `org_id` | string | Related organization |
| `document_id` | string | Related KBBDocument |
| `document_title` | string | Cached document title |
| `type` | enum | `renewal_30`, `renewal_7`, `renewal_overdue` |
| `message` | string | Notification body text |
| `is_read` | boolean | Read/unread state |

---

## Pages & Routes

| Route | Component | Access |
|---|---|---|
| `/login` | `Login` | Public |
| `/register` | `Register` | Public |
| `/forgot-password` | `ForgotPassword` | Public |
| `/reset-password` | `ResetPassword` | Public |
| `/` | `Dashboard` | Authenticated |
| `/documents/new` | `DocumentForm` | Authenticated |
| `/documents/:id` | `DocumentView` | Authenticated |
| `/documents/:id/edit` | `DocumentForm` | Authenticated |
| `/settings` | `Settings` (collapsible sections) | Org Admin |
| `/settings/fields` | `FieldManagement` | Org Admin |
| `/settings/layout` | `LayoutCustomization` | Org Admin |
| `/settings/teams` | `TeamManagement` | Org Admin |

---

## Components

### AppLayout
The persistent shell wrapping all authenticated pages. Contains:
- **Top navigation bar** — logo, notification bell, dark/light mode toggle, user avatar + name, logout button.
- **Left sidebar** (desktop) — links to Knowledge Base and Settings.
- **Mobile overlay nav** — hamburger-triggered slide-in nav.

### OrgSwitcher
A dropdown button showing the currently selected organization. Allows users to switch between organizations they belong to. Rendered in the **Settings page header**.

### NotificationBell
A bell icon in the header that shows unread notification count and a dropdown list of renewal alerts. Supports mark-as-read individually or all-at-once. Polls every 60 seconds.

### RenewBadge
Inline badge rendered next to document titles indicating renewal urgency:
- 🔴 **Overdue** — past renewal date
- 🟠 **Urgent** — within 7 days
- 🟡 **Due Soon** — within 30 days

### DocumentPreview
A modal with an `<iframe>` for in-app document viewing. Supports PDFs, Microsoft Office files (via Office Online viewer), and Google Docs.

### CustomFieldInput
A factory component that renders the correct input control based on `field.input_type`: short text, paragraph, single-select dropdown, or multi-select buttons.

---

## Context & State

### OrgContext (`lib/OrgContext.jsx`)
Global context providing:
- `orgs` — all organizations the user has access to
- `currentOrg` — the active organization (persisted to `localStorage`)
- `setCurrentOrg(org)` — switches the active org
- `user` — the currently authenticated user
- `isOrgAdmin(org)` — returns `true` if the user is a Super Admin or listed in `org.admin_user_ids`
- `refreshOrgs()` — re-fetches the org list from the API

### AuthContext (`lib/AuthContext.jsx`)
Wraps the app and manages auth loading state, public settings, and auth errors (e.g. `user_not_registered`, `auth_required`).

---

## Backend Functions

### `renewalNotifications`
A scheduled backend function that runs daily to check all documents with `renew_date` values and:
1. Creates `Notification` records for org admins when a document is 30 days from expiry.
2. Creates `Notification` records when a document is 7 days from expiry.
3. Sets `renew_notified_30` / `renew_notified_7` flags on the document to prevent duplicate alerts.

---

## Authentication & Access Control

| Role | Capabilities |
|---|---|
| **Super Admin** (`role: "admin"`) | Full access — manage all organizations, all settings, all documents |
| **Org Admin** (`org.admin_user_ids` includes user) | Manage settings, fields, layout, teams for their org |
| **Standard User** | View and create documents; see only documents visible to their teams |

- Auth is handled by Base44 (email/password + Google OAuth).
- Route protection via `ProtectedRoute` and in-component role checks.
- Document visibility (`everyone` vs `teams`) is enforced client-side based on team membership.

---

## Settings & Configuration

Accessed at `/settings` (Org Admins only). Three tabs:

### Field Management (`/settings/fields`)
- Toggle visibility of built-in system fields (Document ID, Description, Tags, Location, Department, Renewal Date).
- Create, edit, deactivate, and delete custom fields with configurable input types and options.

### Layout Customization (`/settings/layout`)
- Drag-and-drop reordering of fields for the **Add Item** screen and **View Details** screen independently.
- Order is persisted as a `FieldConfig` record per organization.

### Team Management (`/settings/teams`)
- Create and delete teams within the organization.
- Assign/remove individual users from teams.
- Used to control document-level visibility.

---

## Notifications

Renewal notifications are generated by the `renewalNotifications` backend function and surfaced via:
- The **NotificationBell** component in the header (unread count badge + dropdown).
- Mark individual or all notifications as read.
- Notifications are scoped per user and per org.

---

## Design System

The app uses a custom design token system defined in `index.css` and mapped in `tailwind.config.js`.

- **Primary color**: Blue (`hsl(225, 73%, 57%)`)
- **Font**: Inter (heading, body, display); JetBrains Mono (data/code)
- **Border radius**: 2px (sharp, professional aesthetic)
- **Dark mode**: Fully supported via `.dark` class toggle (user-controlled from the header)
- **Utility classes**: `.kbb-card`, `.kbb-input`, `.field-label`, `.font-mono-data`

### Color Tokens

| Token | Light | Dark |
|---|---|---|
| `--background` | `hsl(0 0% 98%)` | `hsl(222 14% 8%)` |
| `--card` | `hsl(0 0% 100%)` | `hsl(222 14% 10%)` |
| `--primary` | `hsl(225 73% 57%)` | same |
| `--muted-foreground` | `hsl(215 13% 44%)` | `hsl(215 13% 60%)` |
| `--border` | `hsl(214 18% 90%)` | `hsl(222 14% 18%)` |

---

*Last updated: June 2026*