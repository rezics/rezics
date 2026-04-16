## 1. Shared slug validation in @rezics/contract

- [x] 1.1 Create `package/contract/src/slug/reserved.ts` with the platform-wide reserved words list (~300+ words, categorized by type: routes, auth, roles, technical, navigation, confusable, brand)
- [x] 1.2 Create `package/contract/src/slug/validate.ts` with `validateSlug()` function and `SlugValidationResult` type — format rules: `[a-z0-9-]`, length 6–36, no leading/trailing/consecutive hyphens, auto-lowercase normalization, reserved word check, configurable options
- [x] 1.3 Create `package/contract/src/slug/schema.ts` with Typebox `slugSchema` (pattern, minLength, maxLength constraints) for use in Elysia route definitions
- [x] 1.4 Create `package/contract/src/slug/index.ts` re-exporting all public symbols
- [x] 1.5 Export slug module from `package/contract/src/index.ts` (or verify it is importable as `@rezics/contract`)
- [x] 1.6 Run `bun run build` or `tsc --noEmit` in `package/contract` to verify compilation

## 2. Migrate auth to shared validation

- [x] 2.1 Update `package/auth/src/identity/identity.api.ts` to import `validateSlug` from `@rezics/contract/slug.js` instead of local `./slugValidation`
- [x] 2.2 Delete `package/auth/src/identity/slugValidation.ts`
- [x] 2.3 Grep for any other imports of the deleted file across `package/auth` and update them
- [x] 2.4 Run `tsc --noEmit` in `package/auth` to verify compilation
- [x] 2.5 Run existing tests in `package/auth` to verify no behavioral regression

## 3. Unit slug database migration

- [x] 3.1 Add `slug String? @unique` field to the `Unit` model in `package/server/prisma/schema.prisma`
- [x] 3.2 Run `bun run prisma:migrate` in `package/server` to generate and apply the migration
- [x] 3.3 Run `bun run prisma:generate` to regenerate the Prisma client

## 4. Server-side slug logic

- [x] 4.1 Add slug validation to the unit creation flow in the server's unit/tag/realm service — only allow slug for `TAG` and `REALM` types, validate via `validateSlug` from `@rezics/contract`
- [x] 4.2 Add slug update endpoint/logic with write-once enforcement: reject if `unit.slug !== null && !isGlobalAdmin(caller)`
- [x] 4.3 Add lookup-by-slug API endpoint — query `Unit` by slug, return unit with translations and type extension, 404 if not found
- [x] 4.4 Add slug field to relevant contract response schemas in `@rezics/contract` (tag detail, realm detail responses) if not already present
- [x] 4.5 Run `tsc --noEmit` in `package/server` to verify compilation

## 5. Frontend API integration

- [x] 5.1 Add slug lookup query options to `@rezics/api` (e.g., `tagBySlugQueryOptions`, `realmBySlugQueryOptions`)
- [x] 5.2 Add slug to tag and realm display/detail models in `package/app` where relevant
- [x] 5.3 Run `tsc --noEmit` in `package/app` and `package/api` to verify compilation

## 6. Verification

- [x] 6.1 Run `bun test` in `package/server` and `package/auth` to verify no regressions
- [x] 6.2 Start dev servers (`bun run server:dev`, `bun run app:dev`) and manually test: create a tag with slug, verify lookup by slug, verify write-once rejection, verify reserved word rejection
