## Why

The app currently has no dedicated settings page. Profile editing is done via `UserEditPage.tsx` (a single MUI Card form for name/avatar/bio/password) and a prototype `UserEditPage2.tsx` (fully mocked, never connected to real APIs). Meanwhile, the backend already supports a rich set of user management capabilities — email changes, OAuth provider linking, session management, API token CRUD, user preferences, keyword vocabulary — none of which are exposed in the frontend. A GitHub-style settings page with sidebar navigation and dedicated sections will surface all these capabilities and give users proper control over their account.

## What Changes

- **Add a new settings page system** at `/user/me/settings` with sidebar navigation (desktop) / top tab navigation (mobile) and route-driven section content.
- **Add Public Profile section** — edit name, bio, description, avatar URL, slug display (read-only after initial set).
- **Add Account section** — view/change email, email verification status, delete account (with confirmation).
- **Add Security section** — change/set password, list active sessions with IP/userAgent/date, revoke individual sessions.
- **Add Connected Accounts section** — display linked OAuth providers (Google, GitHub, Microsoft, Twitter, Telegram), link/unlink providers.
- **Add API Tokens section** — list tokens, create new token (name, scopes, expiry), edit token metadata, revoke tokens, show raw token on creation (one-time display).
- **Add Preferences section** — language preferences, realm tag preferences, keyword vocabulary management (add/remove keywords).
- **Remove `UserEditPage.tsx` and `UserEditPage2.tsx`** — replaced by settings profile section.
- **Wire "Edit profile" button** on the profile page (from `profile-page-redesign` change) to `/user/me/settings/profile`.

## Capabilities

### New Capabilities
- `settings-layout`: Settings page shell with sidebar navigation (desktop) and top tabs (mobile), route-driven content sections.
- `settings-profile`: Public profile editing section — name, bio, description, avatar, slug display.
- `settings-account`: Account management section — email viewing/changing, email verification status, account deletion with confirmation.
- `settings-security`: Security section — password change/set, active session list with details, session revocation.
- `settings-connections`: Connected accounts section — OAuth provider display, link/unlink via social sign-in flow.
- `settings-tokens`: API token management section — token CRUD, scope selection, expiry configuration, one-time raw token display on creation.
- `settings-preferences`: User preferences section — language preferences, realm tag preferences, keyword vocabulary add/remove.

### Modified Capabilities
_(none — all backend APIs already exist; this change adds frontend UI only)_

## Impact

- **Affected packages**: `package/app` (primary — all settings UI), `package/api` (no changes — all mutations and queries already exist: `userMutations`, `authMutations`, `tokenMutations`, `userQueries`, `authQueries`, `tokenQueries`)
- **Components removed**: `UserEditPage.tsx`, `UserEditPage2.tsx` — fully replaced by settings sections.
- **New routes**: `/user/me/settings`, `/user/me/settings/profile`, `/user/me/settings/account`, `/user/me/settings/security`, `/user/me/settings/connections`, `/user/me/settings/tokens`, `/user/me/settings/preferences`.
- **Dependency on `profile-page-redesign`**: The "Edit profile" and gear icon buttons on the profile page should link to `/user/me/settings/profile`. If profile-page-redesign is not yet landed, the settings page still works as a standalone route.
- **No backend changes required** — all functionality uses existing API endpoints.
- **Backward compatibility**: `/user/me/edit` should redirect to `/user/me/settings/profile`.
