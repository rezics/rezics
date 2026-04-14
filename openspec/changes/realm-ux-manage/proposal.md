## Why

The realm detail page currently provides no way for moderators, admins, owners, or global admin/root users to access realm management. There is no manage icon, no link to the manage page, and no API endpoint to check the current user's membership role. The manage page itself (`/realm/:realmId/manage`) exists but has no frontend permission guard and sends translations in a payload shape that the backend may not accept.

Additionally, the "Untitled Realm" issue needs investigation and fixing — likely caused by seed data or translation resolution edge cases.

## What Changes

- Add `GET /realms/:unitId/members/me` endpoint returning the current user's realm membership and role
- Add manage icon/button on `RealmPage` visible to realm moderator+ roles **and** global admin/root users
- Add frontend permission guard on `RealmManagePage` — redirect unauthorized users
- Fix `RealmManagePage` translation update to use the correct API path
- Investigate and fix the "Untitled Realm" rendering issue (seed data / translation resolution)
- Ensure the existing `realm-frontend` spec requirement for role-based UI visibility is properly implemented for global admin/root users (who can manage all realms regardless of membership)

## Capabilities

### New Capabilities

- `realm-membership-me`: Backend endpoint and frontend hook for checking current user's realm role

### Modified Capabilities

- `realm-frontend`: Update role-based UI visibility to include global admin/root users and add manage affordance on the detail page

## Impact

- **`package/server`**: New endpoint in `realm.api.ts`, no schema changes
- **`package/contract`**: Possible new response type for membership-me endpoint (or reuse `RealmMemberDTO`)
- **`package/api`**: New query hook `useMyRealmMembership`
- **`package/app`**: `RealmPage` updated with conditional manage icon, `RealmManagePage` gets permission guard and translation fix
- **`package/server/prisma/seed`**: Verify realm translations are properly seeded
