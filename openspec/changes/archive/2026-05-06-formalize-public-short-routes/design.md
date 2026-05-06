## Context

The app already treats `/unit/:unitId` as a frontend resolver rather than a
normal page. Its loader fetches the Unit by id, checks visibility, calls
`buildUnitUrl(unit)`, redirects to a typed destination when available, and falls
back to `/unit/:unitId/view` for the generic Unit page.

The backend and API client are id-primary. `GET /unit/:unitId` is the canonical
single-item API route, while `GET /unit/by-slug/:slug` and typed endpoints such
as `GET /realm/by-slug/:slug` are alternate unique-key lookups. This is a
different layer from browser-facing URLs.

Current pain points:

- Public slug routes are not consistently short or canonical.
- User slug and Unit slug need separate namespaces.
- `/unit/:unitId` cannot become `/unit/:unitSlug` without preserving an id
  fallback and generic Unit view.
- Public route params are not currently represented as shared contract schemas
  with JSDoc.

## Goals / Non-Goals

**Goals:**

- Make `/unit/:unitSlug` the canonical public Unit slug resolver.
- Move public Unit id resolution to `/unit/id/:unitId`.
- Keep `/u/:userSlug` separate from all Unit slug resolution.
- Preserve automatic typed redirects by default.
- Provide `?view=unit` to render the generic Unit view without typed redirect.
- Add shared contract schemas/constants for public route params and Unit
  resolver search params.
- Keep API lookup naming explicit and id-primary.

**Non-Goals:**

- Do not make `/unit/:identifier` accept either id or slug.
- Do not require every Unit to have a slug. Slug routes return 404 when no
  `Unit.slug` match exists.
- Do not rename all API id routes to `/id/:id` or all slug routes to
  `/slug/:slug`.
- Do not broaden Unit slug support beyond the types already allowed by
  `unit-slug` unless a separate capability changes that rule.

## Decisions

### D1: Keep API model A

API routes remain id-primary:

```txt
GET /unit/:unitId
GET /unit/by-slug/:unitSlug
GET /realm/by-slug/:realmSlug
GET /zone/by-slug/:zoneSlug
GET /tag/by-slug/:tagSlug
```

Public routes use browser-facing canonical paths:

```txt
/u/:userSlug
/unit/:unitSlug
/unit/id/:unitId
```

Rationale: API routes optimize for explicit machine contracts and existing
resource conventions. Public routes optimize for short, shareable URLs. Keeping
these layers separate avoids turning one route shape into a compromised hybrid.

Alternatives considered:

- `/unit/slug/:slug` for public routes: rejected because it defeats the short URL
  goal.
- `/unit/id/:unitId` and `/unit/slug/:slug` for API routes: rejected because it
  makes Unit a special API exception and conflicts with the existing
  `api-route-convention`.
- `/:identifier` mixed id-or-slug routes: rejected because fallback semantics are
  ambiguous and easy to misuse.

### D2: Unit public resolver is slug-first with an id fallback

Target route behavior:

```txt
/unit/realm-a
  └─ resolve Unit.slug = "realm-a"
     └─ type REALM
        └─ redirect /r/realm-a

/unit/realm-a?view=unit
  └─ resolve Unit.slug = "realm-a"
     └─ render generic Unit page

/unit/id/<uuid>
  └─ resolve Unit.id = <uuid>
     └─ redirect typed public route

/unit/id/<uuid>?view=unit
  └─ resolve Unit.id = <uuid>
     └─ render generic Unit page
```

The resolver SHALL NOT fall back from slug to id or id to slug. A slug miss is a
404 for `/unit/:unitSlug`, even if a Unit id happens to equal the path segment.

### D3: `?view=unit` controls generic rendering

The Unit resolver search contract uses `view=auto | unit`, with omitted search
params equivalent to `view=auto`.

- `view=auto`: resolve Unit, apply access control, redirect to typed public route
  when one exists, otherwise render/fallback to generic Unit view.
- `view=unit`: resolve Unit, apply access control, render the generic Unit page
  directly, and suppress typed redirects.

Rationale: `view=unit` describes desired user-visible behavior. A flag such as
`redirect=false` describes an implementation detail and creates negative logic.

### D4: Contract owns public route schemas

Add a contract module such as `package/contract/src/public-route.ts` exporting
schemas with JSDoc:

- `publicUserSlugRouteParamsSchema`
- `publicUnitSlugRouteParamsSchema`
- `publicUnitIdRouteParamsSchema`
- `publicUnitResolverSearchSchema`
- optional constants for canonical route templates if useful for callers

The JSDoc must state what each path resolves and what it never resolves. This is
the human-readable contract beside the runtime TypeBox schemas.

### D5: Typed public destinations may be introduced gradually

The Unit resolver can redirect to typed public routes as they become canonical:

```txt
REALM -> /r/:realmSlug when slug exists
ZONE  -> /z/:zoneSlug when slug exists
TAG   -> /t/:tagSlug when slug exists
```

For Units without typed slug routes or without slugs, id-based typed routes may
continue during migration. The resolver must still honor `?view=unit`.

## Risks / Trade-offs

- [Risk] Existing links to `/unit/:unitId` may break when `/unit/:slug` becomes
  canonical. → Add a migration route or redirect for UUID-shaped legacy segments
  to `/unit/id/:unitId` where practical, and update internal links first.
- [Risk] Typed destination routes may not all have slug versions yet. → Let
  `buildUnitUrl` fall back to id-based typed routes during migration, while the
  resolver contract remains stable.
- [Risk] `?view=unit` can create duplicate URLs for the same content. → Treat
  `/unit/:unitSlug` as the canonical public entry and `?view=unit` as an
  explicit inspection/debug/share mode for the Unit layer.
- [Risk] Slugs are optional and type-gated. → Document that slug lookup routes
  return 404 for units without slugs and do not fall back to ids.
- [Risk] API and public route naming remain different. → Capture the model in
  both `public-short-routes` and `api-route-convention` so the difference is
  intentional and testable.

## Migration Plan

1. Add contract schemas and exports for public routes.
2. Add new frontend route files for `/unit/$unitSlug` and `/unit/id/$unitId`.
3. Move current id resolver behavior under `/unit/id/$unitId`.
4. Add slug resolver behavior under `/unit/$unitSlug`.
5. Add `view=unit` search validation and generic Unit rendering path.
6. Update `buildUnitUrl` and links to prefer canonical public slug routes where
   the target Unit has a slug.
7. Add compatibility redirects for legacy `/unit/:unitId` traffic if route
   matching can distinguish UUID-shaped ids safely.
8. Update tests for resolver behavior, slug misses, id misses, access control,
   and `?view=unit`.

Rollback: keep the existing id-primary route implementation available behind
`/unit/id/:unitId`; if slug resolver rollout fails, internal links can revert to
the id fallback without changing backend APIs.

## Open Questions

- Which typed public route slugs are canonical in the first implementation
  batch: `/r`, `/z`, `/t`, or only `/unit` plus existing typed id routes?
- Should legacy `/zone/:slug` remain as a public route, redirect to `/z/:slug`,
  or be treated only as an API compatibility path?
- Should route constants live in the contract package as plain strings, helper
  functions, or only TypeBox schemas with JSDoc?
