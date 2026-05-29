## 1. Per-Kind Notification Preferences

- [x] 1.1 Add a `notificationPreferenceSchema` (per-kind boolean toggles: reply, follow, dm, moderation, realm, system) to `userSettings` in `package/contract/src/user.ts`; default all enabled when absent.
- [x] 1.2 Persist via the existing typed `userSettings` mutation (no new endpoint if the partial-update path covers it); add server-side defaulting/merge.
- [x] 1.3 Enforce preferences in the notification dispatch pipeline (`dispatch.service` / `notify-boundary`): suppress feed + push delivery for disabled kinds at creation time, not just at read time.
- [x] 1.4 Build the `settings/preferences` (or dedicated `settings/notifications`) per-kind toggle UI; persist through the typed mutation; optimistic + error states.
- [x] 1.5 Tests: disabling follow suppresses new follow notifications while other kinds still deliver; preference round-trips through the mutation.

## 2. Blocked-Users Management

- [x] 2.1 Decide the block model: introduce a `Block` table (blockerUserId, blockedUserId, createdAt) and a `block.service` (list/add/remove); evaluate reusing/relating the existing DM block (`/dm/blocks`).
- [x] 2.2 Add typed contract + endpoints: list my blocks, add block, remove block.
- [x] 2.3 Enforce block in content visibility (hide blocked users' content) and DM (prevent send), scoped by the foundation policy engine.
- [x] 2.4 Build the blocked-users Settings sub-page (view, add, remove) through `@rezics/api`.
- [x] 2.5 Tests: unblock makes the peer's content visible on next fetch; blocked peer cannot DM; content hidden in feeds.

## 3. Data Export & Account Deletion

- [x] 3.1 Define the export payload scope and a deletion data-handling policy (removed vs anonymized vs retained for safety/audit); document it for the confirmation copy.
- [x] 3.2 Add typed export endpoint (assemble the user's data) and account-deletion endpoint with explicit confirmation token.
- [x] 3.3 Build the Settings data/account section: export entry point and deletion flow with a confirmation step describing data handling; never proceed without explicit confirmation.
- [x] 3.4 Tests: deletion requires explicit confirmation; export returns the documented scope; safety/audit-retained data is excluded from deletion as specified.

## 4. Cross-Cutting

- [x] 4.1 i18n coverage for all new Settings copy across the 6 locales; `check:i18n` parity.
- [x] 4.2 Update `settings-layout` spec on archive; ensure no app-local DTO copies and all access goes through `@rezics/api`.
