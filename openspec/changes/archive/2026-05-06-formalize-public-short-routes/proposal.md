## Why

Slug URLs currently mix two concerns: API lookup endpoints use explicit
`/by-slug/*` paths, while browser-facing routes sometimes expose long paths or
historical id params. This makes slugs less useful as short public URLs and
keeps the Unit resolver's id-only route shape from expressing Unit as the
platform's public foundation.

We need a documented contract that separates public short routes from API lookup
routes, keeps user slugs and Unit slugs in separate namespaces, and preserves an
explicit Unit id fallback.

## What Changes

- Introduce public short route contracts in `@rezics/contract`, including
  TypeBox schemas with JSDoc for `/u/:userSlug`, `/unit/:unitSlug`,
  `/unit/id/:unitId`, and Unit resolver search params.
- Define `/u/:userSlug` as the canonical user profile route. It resolves only
  user slugs and never queries the Unit slug namespace.
- Define `/unit/:unitSlug` as the canonical public Unit slug resolver. It
  resolves only `Unit.slug`; units without slugs return 404 through this route.
- Define `/unit/id/:unitId` as the public technical id fallback for Unit
  resolver navigation. It resolves only `Unit.id`.
- Define Unit resolver search semantics: default behavior auto-redirects to the
  typed public route when available; `?view=unit` suppresses the typed redirect
  and renders the generic Unit page.
- Keep API model A: primary resource reads stay id-first (`GET /unit/:unitId`),
  while alternate unique-key lookups use explicit `GET /unit/by-slug/:unitSlug`
  and typed equivalents such as `/realm/by-slug/:realmSlug`.
- Retire misleading frontend route semantics where `/unit/:unitId` is the public
  resolver path. The by-id resolver moves to `/unit/id/:unitId`.
- No new external dependencies.

## Capabilities

### New Capabilities

- `public-short-routes`: Browser-facing canonical route namespaces, public route
  param/search schemas, and user-vs-Unit slug separation.

### Modified Capabilities

- `unit-resolver`: Unit resolver routing changes from id-only `/unit/:unitId` to
  slug-first `/unit/:unitSlug` plus id fallback `/unit/id/:unitId`, with
  `?view=unit` controlling generic Unit rendering.
- `api-route-convention`: Clarifies that API primary item routes remain
  id-first and that `/by-slug/:slug` is the explicit alternate-key lookup shape,
  distinct from public browser routes.

## Impact

- `package/contract`: add public route schemas/constants with JSDoc and export
  them from the contract barrel.
- `package/app`: update TanStack Router routes for `/u/:userSlug`,
  `/unit/:unitSlug`, and `/unit/id/:unitId`; update links and `buildUnitUrl`
  behavior to use public route contracts.
- `package/api`: keep `getBySlug` API client methods aligned with
  `/by-slug/:slug`; use route contract names consistently in query keys and
  helper names where touched.
- `package/server`: no broad REST route migration is intended. Existing
  id-primary and typed `by-slug` endpoints remain the API contract; any
  inconsistent legacy endpoint such as a typed slug lookup at `/:slug` should be
  treated as compatibility-only or cleaned up in implementation if safely scoped.
- `openspec`: new `public-short-routes` spec plus deltas for `unit-resolver` and
  `api-route-convention`.

Backward compatibility: existing `/unit/:unitId` frontend links need redirect or
navigation migration to `/unit/id/:unitId`. Existing API consumers of
`/unit/:unitId` and `/unit/by-slug/:slug` remain compatible. Existing short
aliases may remain as redirects during a migration window, but the canonical
routes are the new public contract.
