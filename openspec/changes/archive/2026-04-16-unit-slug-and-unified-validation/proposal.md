## Why

Tags and realms currently lack human-readable identifiers — they are only addressable by UUID. Adding slug support to these unit types enables clean URLs (`/tag/science-fiction`, `/realm/book-club`) and improves discoverability. Slug validation logic already exists in `@rezics/auth` for user profiles, but it is local to that package and cannot be reused by the server. A shared validation foundation in `@rezics/contract` benefits both existing user slugs and the new unit slugs.

## What Changes

- Add a nullable, globally unique `slug` field to the `Unit` model in the server database
- Only `TAG` and `REALM` unit types may have a slug set; all other types are excluded
- Slugs are write-once for non-admin users: once set, only global administrators can modify them
- Slugs can be set at creation time or added later (one-time)
- Move slug validation logic from `@rezics/auth` to `@rezics/contract` as a shared utility
- Expand the reserved words list from ~50 entries to a comprehensive platform-level blocklist (~300+ common terms)
- Tighten slug format: lowercase-only `[a-z0-9-]`, length 6–36, no leading/trailing/double hyphens
- **BREAKING**: `@rezics/auth` identity endpoints will import validation from `@rezics/contract` instead of the local `slugValidation.ts` (internal refactor, no API-facing break)

## Goals

- Provide stable, human-readable identifiers for tags and realms
- Unify slug validation rules across the platform (user slugs, unit slugs, organization slugs)
- Prevent registration of common/confusing slugs via a comprehensive reserved words list

## Non-goals

- Slug support for other unit types (BOOK, SHELF, CHAPTER, etc.) — not planned
- Cross-system uniqueness between user slugs (auth DB) and unit slugs (server DB) — these remain independent namespaces
- Slug-based routing in the frontend (can be added later; this change provides the data layer)

## Capabilities

### New Capabilities

- `unit-slug`: Slug field on Unit, type-gated to TAG/REALM, write-once semantics, admin override, lookup-by-slug API
- `slug-validation`: Shared slug format validation, reserved words list, and Typebox schema in `@rezics/contract`

### Modified Capabilities

- `registration-identity-step`: User slug validation will be sourced from `@rezics/contract` instead of local auth code. No behavioral change, only import path.

## Impact

- **`@rezics/contract`**: New `slug.ts` module with validation logic, reserved words, and Typebox schemas
- **`@rezics/server`**: Schema migration (add `slug` column + unique index on `Unit`), new/modified service logic for setting and looking up slugs, API endpoints
- **`@rezics/auth`**: Remove local `slugValidation.ts`, update imports to `@rezics/contract`
- **`@rezics/api`**: New query options for slug lookup (tag/realm by slug)
- **`@rezics/app`**: Tag and realm detail pages gain slug-based addressing
- **Backward compatibility**: Existing units without slugs continue to work. The `slug` field is nullable — no migration backfill needed. Auth service validation behavior is unchanged (same rules, different import).
