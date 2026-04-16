## Context

Currently the app has two edit pages: `UserEditPage.tsx` (connected to `userApi.updateMe()` for name/avatar/bio/password) and `UserEditPage2.tsx` (fully mocked, never wired to real APIs, uses non-standard UI components like RoseTextField). The backend supports a comprehensive set of user management APIs that have no frontend surface:

- **Auth API**: `authApi.changeEmail()`, `authApi.setPassword()`, `authApi.listSessions()`, `authApi.revokeSession()`, `authApi.signInSocial()`, `authApi.getSessionState()` (returns linked providers, email verification status, password status)
- **Token API**: `tokenApi.list()`, `tokenApi.create()`, `tokenApi.update()`, `tokenApi.revoke()` — full CRUD with scopes (`user:read`, `user:write`, `dispatch:rezics-server-session`)
- **User API**: `userApi.updateMe()`, `userApi.getSettings()`, `userApi.updateSettings()`, keywords CRUD
- **Auth mutations**: `useChangeEmailMutation()`, `useSetPasswordMutation()`, `useRevokeSessionMutation()` — all exist in `package/api`

The settings page will surface all of these through a GitHub-style sidebar-navigated settings interface.

## Goals / Non-Goals

**Goals:**
- Complete settings page system with 6 sections covering all backend user management capabilities
- GitHub-inspired sidebar navigation (desktop) with responsive mobile layout
- Proper form handling with validation, loading states, success/error feedback
- Secure patterns for sensitive operations (account deletion confirmation, one-time token display, session revocation)

**Non-Goals:**
- Admin-only settings (JWT service management, user banning, email templates — these belong in the admin panel)
- Two-factor authentication (backend does not yet support TOTP/WebAuthn)
- Avatar file upload (currently URL-based; file upload is a separate feature)
- Notification preferences (no notification system yet)

## Decisions

### 1. Route structure: layout route with sidebar navigation

**Decision:** Use a TanStack Router layout route at `/user/me/settings/route.tsx` that renders a `SettingsShell` (sidebar + content area), with child routes for each section.

**Route tree:**
```
routes/_mainLayout/user/me/settings/
  route.tsx          → layout: SettingsShell (sidebar + Outlet)
  index.tsx          → redirect to /profile
  profile.tsx        → Public profile section
  account.tsx        → Account section
  security.tsx       → Security section
  connections.tsx    → Connected accounts section
  tokens.tsx         → API tokens section
  preferences.tsx    → Preferences section
```

**Rationale:** Matches the profile-page-redesign pattern (layout route + child routes). Settings is always `/user/me/settings` (not `/user/$unitId/settings`) because you can only edit your own settings.

### 2. Navigation: sidebar on desktop, horizontal tabs on mobile

**Decision:** Desktop renders a persistent sidebar (left) with section links and a content area (right). Mobile renders horizontal scrollable MUI Tabs at the top, then section content below.

```
Desktop:                          Mobile:
┌────────────┬────────────────┐   ┌──────────────────────┐
│  Sidebar   │  Content       │   │ Profile│Account│Sec> │
│            │                │   │ ═══════════════════  │
│  Profile   │  [Section]     │   │                      │
│  Account   │                │   │  [Section content]   │
│  Security  │                │   │                      │
│  Connected │                │   └──────────────────────┘
│  Tokens    │                │
│  Prefs     │                │
└────────────┴────────────────┘
```

**Rationale:** GitHub uses sidebar on desktop, drawer on mobile. MUI Tabs for mobile is simpler and more consistent with the profile page's tab pattern. A drawer requires extra interaction (hamburger → open → select → close) while tabs are immediately visible.

### 3. Form pattern: MUI TextField (standard variant, borderless) with section cards

**Decision:** Per project UI conventions (Apple-inspired, "no MUI" means TextField only, borderless inputs), settings sections use:
- No bordered section cards — sections flow directly in the content area separated by dividers
- MUI `TextField` with `variant="standard"` for inputs (borderless bottom-line style)
- Section headers as `Typography variant="h6"` with subtle description text below
- Action buttons aligned right, using MUI `Button` (contained for primary, outlined for secondary, error color for destructive)

**Alternative considered:** Using `ShadowRoundedCard` from UserEditPage2. Rejected — violates the "no bordered cards for sections" UI feedback.

### 4. Token management: one-time display pattern

**Decision:** When a new API token is created, the raw token string (returned by `tokenApi.create()`) is shown in a highlighted, copyable field with a "Copy" button and a warning that it won't be shown again. After the user dismisses or navigates away, the raw token is lost. The token list only shows metadata (name, scopes, dates, last IP).

**Rationale:** Follows the GitHub personal access token pattern. The raw token is only available from the creation response — the backend stores only the hash.

### 5. Session management: current session identification

**Decision:** The session list from `authApi.listSessions()` shows IP, user agent, and creation date. The current session is identified by matching the session token. The current session displays a "Current session" badge and cannot be revoked. Other sessions show a "Revoke" button.

**Rationale:** Prevents users from accidentally logging themselves out. GitHub uses the same pattern.

### 6. Connected accounts: link/unlink flow

**Decision:** The Connected Accounts section shows each supported provider (Google, GitHub, Microsoft, Twitter, Telegram) with its connection status. "Connect" triggers `authApi.signInSocial()` which returns a redirect URL — the user completes OAuth in a new tab/popup and the page refreshes to show the updated state. "Disconnect" is not yet supported by the better-auth backend, so disconnection buttons are hidden or disabled with a tooltip.

**Rationale:** The `authSessionState` response includes `providerIds` (array of connected provider IDs), making it straightforward to show connection status. The `signInSocial` flow handles linking when the user is already authenticated.

### 7. Component architecture

```
user/
  component/
    SettingsShell.tsx          (sidebar + content layout)
    SettingsSidebar.tsx        (desktop sidebar nav)
    SettingsTabBar.tsx         (mobile top tabs)
    SettingsSection.tsx        (reusable section container: heading + description + content)
    TokenCreateDialog.tsx      (modal for creating new API token)
    TokenListItem.tsx          (single token display in the list)
    SessionListItem.tsx        (single session display)
    ProviderCard.tsx           (OAuth provider connection card)
    DangerZone.tsx             (red-bordered section for destructive actions)
  section/
    SettingsProfileSection.tsx
    SettingsAccountSection.tsx
    SettingsSecuritySection.tsx
    SettingsConnectionsSection.tsx
    SettingsTokensSection.tsx
    SettingsPreferencesSection.tsx
  page/
    (UserEditPage.tsx — removed after this change)
    (UserEditPage2.tsx — removed after this change)
```

### 8. Data flow: queries and mutations per section

| Section | Queries | Mutations |
|---------|---------|-----------|
| Profile | `userQueries.me()` | `useUpdateMeMutation()` |
| Account | `authQueries.sessionState()` | `useChangeEmailMutation()`, `useDeleteMeMutation()` |
| Security | `authQueries.sessionState()`, `authQueries.sessions()` | `useSetPasswordMutation()`, `useRevokeSessionMutation()` |
| Connections | `authQueries.sessionState()` | `signInSocial()` (redirect, not mutation) |
| Tokens | `tokenQueries.list()` | `useCreateTokenMutation()`, `useUpdateTokenMutation()`, `useRevokeTokenMutation()` |
| Preferences | `userQueries.settings()`, `userQueries.me()` (keywords) | `useUpdateSettingsMutation()`, keywords PATCH |

## Risks / Trade-offs

**[Account deletion is irreversible]** → Require a confirmation dialog with the user typing their email or slug to confirm. Use MUI Dialog with a TextField that must match before the delete button enables.

**[OAuth disconnect not supported]** → better-auth does not expose an "unlink provider" endpoint. Show connected providers as read-only with a "Connected" badge. Add a disabled "Disconnect" button with tooltip "Coming soon" if desired, or omit entirely.

**[Keywords API has 500 limit]** → The preferences section must show the current count and prevent adding beyond 500. Show a counter like "124 / 500 keywords".

**[Token raw value shown once]** → Users may accidentally close the dialog. Add a prominent warning banner and require explicit "I've copied the token" acknowledgment before allowing the dialog to close. The copy button should provide visual feedback (checkmark icon).

**[Settings page requires auth]** → All routes under `/user/me/settings` must check authentication. If not authenticated, redirect to login. Use the existing auth guard pattern from the route's `beforeLoad`.
