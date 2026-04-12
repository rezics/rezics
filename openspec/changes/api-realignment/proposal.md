## Why

The `@rezics/api` package has drifted out of alignment with the backend (`@rezics/server`) and the frontend (`@rezics/app`, `@rezics/admin`). Multiple API client methods call paths that don't exist on the server (causing 404s), several backend endpoints have no client coverage at all, and deprecated domain stubs (comment, review, readlist) persist as dead code. This blocks frontend development for any feature that depends on the misaligned or missing endpoints.

## What Changes

### Fix broken paths (API client → server mismatches)
- **Tag `getForUnit`**: Change from `GET /tags?unitId=...` to `GET /tags/for-unit/:unitId`. Fix return type from `{tags, total}` to `{tags}`.
- **Realm content routes**: Change `/realms/:id/units` to `/realms/:id/content` for add, remove, and list operations.
- **Realm tag routes**: Change `/realms/:id/tag-units` to `/realms/:id/tags`. Change `removeTagUnit` from DELETE-with-body to `DELETE /tags/:tagUnitId/:contentUnitId`.
- **Realm leave**: Change from `DELETE /members/me` to `DELETE /members/:userId` using `getRezicsSessionClaims()` from the JWT layer to resolve the current user's unitId.

### Remove phantom code (client calls endpoints that don't exist)
- **BREAKING**: Remove `userApi.adminCreate()` and `useAdminCreateUserMutation` — `POST /users/admin` does not exist on the server.
- Remove `realmApi.getMembers()`, `realmApi.getUnits()`, `realmApi.getTagUnits()` — no server GET endpoints exist for these. Remove corresponding query options and keys.

### Add missing API modules (server endpoints with no client)
- Add **Link API** module: CRUD for `/links` (create, get, update, delete).
- Add **Attribution API** module: persons, organizations, and credit links at `/attribution`.
- Add **DM API** module: `POST /dm/send` for direct messages.
- Add **user batch lookup**: `GET /users/batch?ids=...` to existing user API.

### Clean up deprecated code
- Delete the `comment/`, `review/`, `readlist/` directories in `@rezics/api` (18 empty stub files).
- Delete stale MSW mock handlers for comment, review, and readlist in `@rezics/app`.
- Migrate 5 frontend files off deprecated meili stubs (`buildMeiliReadlistQuery`, `buildMeiliReviewQuery`) to use content search or shelf/post queries, then remove the stubs.

## Capabilities

### New Capabilities
- `link-api-client`: API client module for link CRUD operations (`/links`)
- `attribution-api-client`: API client module for person/organization/credit operations (`/attribution`)
- `dm-api-client`: API client module for sending direct messages (`/dm/send`)

### Modified Capabilities
_(No existing spec-level requirements are changing — this is an implementation alignment, not a behavior change.)_

## Impact

**Affected packages:**
- `package/api` — Fix paths, remove phantoms, add new modules, delete deprecated stubs, update exports
- `package/app` — Migrate 5 files off deprecated meili stubs, remove stale mock handlers, update mock handler index
- `package/admin` — No direct changes expected (no deprecated imports found)

**Breaking changes:**
- `userApi.adminCreate()` and `useAdminCreateUserMutation` are removed. No external consumer found, but any code depending on these will fail at compile time.
- `realmQueries.members`, `realmQueries.units`, `realmQueries.tagUnits` are removed. No external consumer found.
- `tagApi.getForUnit()` return type changes from `{tags, total}` to `{tags}`. Three frontend files use this and will need updating.
- Deprecated barrel exports (`@rezics/api/comment/...`, `@rezics/api/review/...`, `@rezics/api/readlist/...`) are removed.

**No server changes.** This change aligns the client to the server, not the other way around.

**No database changes.**

**Backward compatibility:** All removed API surface was either dead code (no consumers) or broken (wrong paths). The meili stub migration requires updating 5 frontend files in the same change to avoid build breakage.
