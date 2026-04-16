## 1. Settings Shell and Route Structure

- [ ] 1.1 Create `SettingsShell` component at `package/app/src/user/component/SettingsShell.tsx` — layout with sidebar (desktop) and top tabs (mobile) + `<Outlet />` content area. Uses responsive CSS: sidebar visible at `md:`, tabs visible below `md`.
- [ ] 1.2 Create `SettingsSidebar` component at `package/app/src/user/component/SettingsSidebar.tsx` — vertical nav list with section links (Profile, Account, Security, Connected Accounts, API Tokens, Preferences). Active link highlighted based on current route.
- [ ] 1.3 Create `SettingsTabBar` component at `package/app/src/user/component/SettingsTabBar.tsx` — mobile-only MUI Tabs (scrollable) for section navigation.
- [ ] 1.4 Create layout route `package/app/src/routes/_mainLayout/user/me/settings/route.tsx` — renders SettingsShell, applies auth guard in `beforeLoad`.
- [ ] 1.5 Create index route `package/app/src/routes/_mainLayout/user/me/settings/index.tsx` — redirects to `/user/me/settings/profile`.
- [ ] 1.6 Create section routes: `profile.tsx`, `account.tsx`, `security.tsx`, `connections.tsx`, `tokens.tsx`, `preferences.tsx` under `package/app/src/routes/_mainLayout/user/me/settings/`.
- [ ] 1.7 Update `/user/me/edit` route to redirect to `/user/me/settings/profile`.

## 2. Shared Settings Components

- [ ] 2.1 Create `SettingsSection` component at `package/app/src/user/component/SettingsSection.tsx` — reusable section wrapper with heading (Typography h6), description text, and content slot. Sections separated by dividers, no bordered cards.
- [ ] 2.2 Create `DangerZone` component at `package/app/src/user/component/DangerZone.tsx` — visually distinct section (red/error border) for destructive actions like account deletion.

## 3. Profile Section

- [ ] 3.1 Create `SettingsProfileSection` at `package/app/src/user/section/SettingsProfileSection.tsx` — form with: avatar URL input + live preview, display name input, bio (multiline), description (multiline), slug (read-only display). Uses `userQueries.me()` for initial data and `useUpdateMeMutation()` for save.
- [ ] 3.2 Add save button with loading state, success feedback (snackbar or inline message), and error display.

## 4. Account Section

- [ ] 4.1 Create `SettingsAccountSection` at `package/app/src/user/section/SettingsAccountSection.tsx` — displays current email with verification badge (from `authQueries.sessionState()`). Shows "Resend verification" button if unverified.
- [ ] 4.2 Add change email form — text input for new email, submit calls `useChangeEmailMutation()`, shows confirmation message.
- [ ] 4.3 Add danger zone with "Delete account" button. Clicking opens a MUI Dialog requiring the user to type their slug to confirm. Confirmed deletion calls `useDeleteMeMutation()`, signs out, and redirects to homepage.

## 5. Security Section

- [ ] 5.1 Create `SettingsSecuritySection` at `package/app/src/user/section/SettingsSecuritySection.tsx` — password change form with conditional current password field (shown only if `authSessionState.hasPassword` is true), new password, and confirm password fields. Submit calls `useSetPasswordMutation()`.
- [ ] 5.2 Add active sessions list — fetches `authQueries.sessions()`, renders each session with user agent, IP, date. Current session marked with badge, no revoke button. Other sessions have "Revoke" button calling `useRevokeSessionMutation()`.
- [ ] 5.3 Create `SessionListItem` component at `package/app/src/user/component/SessionListItem.tsx` — displays parsed user agent (browser + OS), IP address, creation date, "Current session" badge or "Revoke" button.

## 6. Connected Accounts Section

- [ ] 6.1 Create `SettingsConnectionsSection` at `package/app/src/user/section/SettingsConnectionsSection.tsx` — lists all 5 providers (Google, GitHub, Microsoft, Twitter, Telegram) with connection status from `authSessionState.providerIds`. Primary provider labeled.
- [ ] 6.2 Create `ProviderCard` component at `package/app/src/user/component/ProviderCard.tsx` — shows provider icon, name, "Connected"/"Primary" badges, and "Connect" button for unconnected providers. Connect triggers `authApi.signInSocial()` redirect.

## 7. API Tokens Section

- [ ] 7.1 Create `SettingsTokensSection` at `package/app/src/user/section/SettingsTokensSection.tsx` — lists tokens from `tokenQueries.list()`. Each token rendered via `TokenListItem`. "Generate new token" button at top.
- [ ] 7.2 Create `TokenListItem` component at `package/app/src/user/component/TokenListItem.tsx` — displays token name, scope chips, creation date, expiry, last used, last IP. "Edit" and "Revoke" action buttons.
- [ ] 7.3 Create `TokenCreateDialog` component at `package/app/src/user/component/TokenCreateDialog.tsx` — MUI Dialog with: name input, scope checkboxes (`user:read`, `user:write`, `dispatch:rezics-server-session`), optional expiry date picker. On create, calls `useCreateTokenMutation()` and transitions to token display state.
- [ ] 7.4 Implement one-time token display in `TokenCreateDialog` — shows raw token in a read-only highlighted field with "Copy" button (clipboard API), warning banner, and explicit dismiss action. Copy button shows checkmark on success.
- [ ] 7.5 Add token edit inline or dialog — allows updating name, scopes, expiry via `useUpdateTokenMutation()`.
- [ ] 7.6 Add token revoke with confirmation dialog — calls `useRevokeTokenMutation()` on confirm.

## 8. Preferences Section

- [ ] 8.1 Create `SettingsPreferencesSection` at `package/app/src/user/section/SettingsPreferencesSection.tsx` — fetches `userQueries.settings()` for preferences data.
- [ ] 8.2 Add language preferences — selectable list/chips for supported languages (zh-hant, zh-hans, en, ja, de). Save via `useUpdateSettingsMutation()`.
- [ ] 8.3 Add realm tag preferences — display and edit per-realm tag display settings. Save via `useUpdateSettingsMutation()`.
- [ ] 8.4 Add keyword vocabulary management — display keywords as removable chips with counter (N / 500). Add input for new keywords. Add calls `PATCH /users/me/keywords` with `{add: [...]}`, remove calls with `{remove: [...]}`. Disable add when at 500.

## 9. Cleanup and Validation

- [ ] 9.1 Remove `UserEditPage.tsx` and `UserEditPage2.tsx` from `package/app/src/user/page/`.
- [ ] 9.2 Update all internal links referencing `/user/me/edit` to point to `/user/me/settings/profile`.
- [ ] 9.3 Verify build passes: `bun run app:dev` starts without errors.
- [ ] 9.4 Test each settings section: verify form submission, loading states, success/error feedback, and data persistence across page reloads.
- [ ] 9.5 Test auth guard: verify unauthenticated users are redirected to login.
- [ ] 9.6 Test responsive layout: verify sidebar on desktop, tabs on mobile, correct section routing.
