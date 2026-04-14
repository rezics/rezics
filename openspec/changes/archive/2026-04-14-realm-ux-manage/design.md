## Context

The realm detail page (`RealmPage.tsx`) currently shows realm info with Join/Leave and tabs (Feed, Tags, Members) but has no manage affordance. The manage page exists at `/realm/:realmId/manage` but:
- No link/icon navigates there from the detail page
- No frontend permission check guards it
- The translation save sends `translations` in the realm update payload (may not be accepted)
- Global admin/root users should be able to manage any realm, not just ones they own

The existing `realm-frontend` spec defines role-based UI visibility for realm-scoped roles (owner, admin, moderator, member) but does not account for global admin/root bypassing realm membership.

There's also an "Untitled Realm" display issue to investigate — the seed does create translations, the API does include them, but something may be off.

## Goals / Non-Goals

**Goals:**
- Add `/realms/:unitId/members/me` endpoint to expose current user's realm role
- Show manage icon on RealmPage for moderator+ and global admin/root
- Guard RealmManagePage with frontend permission check
- Fix translation update flow on the manage page
- Fix "Untitled Realm" rendering issue

**Non-Goals:**
- Redesigning the manage page layout
- Adding new management capabilities beyond what already exists
- Changing realm permission model on the backend (already correct)

## Decisions

### 1. New endpoint: GET /realms/:unitId/members/me

Returns the current user's `RealmMemberDTO` (with `roleKey`) or `null` if not a member. Requires authentication.

**Rationale:** The frontend needs to know the user's realm role to conditionally render the manage icon. The existing `GET /realms/me` returns all realms (overkill for a single realm check). A targeted endpoint is cleaner and cacheable per-realm.

### 2. Manage icon visibility logic

```
canManage =
  globalRole === "ADMIN" || globalRole === "ROOT"
  || memberRole in ["owner", "admin", "moderator"]
```

The icon appears in the RealmPage header row, next to the realm title. It links to `/realm/:realmId/manage`.

**Rationale:** Global admin/root can manage all realms (this is an established convention in the backend permission system via `BasicAdminPermission`). Realm moderators+ can manage their own realm.

### 3. Frontend permission guard on RealmManagePage

On mount, check `canManage` (same logic as icon). If false, redirect to `/realm/:realmId`. Use the same `useMyRealmMembership` hook + `useAuthSessionStore` global role check.

**Alternative considered:** Server-side redirect — rejected because the backend already returns 403 on unauthorized mutations. A frontend guard provides better UX (no blank page with error).

### 4. Fix translation update: separate API call

`RealmManagePage` currently sends translations inside the realm update payload. Instead, call the translation upsert endpoint separately (via the unit translation service). The realm update mutation handles realm-specific fields only (`isPublic`, `isOfficial`, `extra`).

### 5. Investigate "Untitled Realm" by checking seed output

Run the seed, query a realm from the API, and verify `unit.translations` is populated with non-null titles. If the seed's `generateTranslations(UnitType.REALM)` can produce translations with null titles, fix the generator.

## Risks / Trade-offs

- **[Risk] Extra API call for membership check on every realm page visit** → Mitigated: Small payload, cacheable via React Query with reasonable stale time (e.g., 5 minutes).
- **[Risk] Race condition between membership query and page render** → The manage icon simply doesn't appear until the query resolves. This is acceptable UX — the icon appears quickly after page load.
