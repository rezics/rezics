## Context

The public URL surface is governed by `public-short-routes`. Short prefixes (`/u/`, `/r/`, `/t/`, `/z/`, `/e/`) are slug-only; long prefixes (`/user/`, `/realm/`, `/tag/`, `/zone/`, `/entity/`, `/unit/`) are unitId-only. The spec mandates that the short-prefix form is the canonical browser-facing identity for slug-bearing units.

The application drift is concentrated in link-build sites. Multiple components hold a DTO that already carries both `unitId` and `slug` (for slug-eligible types), yet build their `<Link to>` paths against the long-prefix unitId routes. The most visible instance is `AccountMenu.tsx:71` linking the profile menu entry to `/user/me`, which redirects via `routes/_mainLayout/user/me/index.tsx:7` to `/user/$userId`. A viewer with a USER slug therefore lands on `/user/<uuid>/...` despite the slug being available on `useUserProfileStore.user`.

The fix is one helper, an audit, and a small spec delta. No new infrastructure, no cache, no contract changes.

A follow-on change `slug-client-resolver` is anticipated to handle the harder case where only a `unitId` is available (no embedded slug) and the link builder still wants to render the slug URL by consulting a client-side cache. That change is explicitly deferred.

## Goals / Non-Goals

**Goals:**

- A single sanctioned helper, `unitHref({ type, unitId, slug })`, that returns a typed TanStack Router path. Slug-when-known, unitId-otherwise. Pure, synchronous, no I/O.
- A thin React wrapper, `useUnitHref(unit)`, for ergonomics when the unit is already a hook-readable value.
- Migration of every link-build site that currently hardcodes a long-prefix path for a slug-bearing type.
- Fix the AccountMenu profile-link bug as the headline outcome.
- One additive spec requirement on `public-short-routes` codifying the link-builder rule.

**Non-Goals:**

- Client-side slug↔unitId cache.
- Reverse lookup from a bare unitId without an embedded slug.
- Chain resolution for owner-scoped sub-resources like `/u/<userSlug>/shelf/<shelfSlug>`.
- DTO-walking middleware that snoops `apiFetch` responses.
- Server-side rename redirects (301 from old slug to new slug).
- Convention check / lint rule enforcement against raw `<Link to="/user/$userId">` (a separate, smaller follow-on).
- Changing the contract surface of `@rezics/contract` route schemas.

## Decisions

### Decision 1: Helper is a pure function in `@rezics/ui`, with an optional React hook

`unitHref` is a pure function exported from `@rezics/ui/primitive/link/` (sibling to the existing `SafeLink`). Signature:

```ts
type SlugBearingType = 'USER' | 'REALM' | 'TAG' | 'ZONE' | 'ENTITY';
type SlugBearingShelf = { type: 'SHELF'; ownerType: 'USER' | 'REALM'; ownerSlug: string | null; ownerUnitId: string };

type UnitHrefInput =
  | { type: SlugBearingType; unitId: string; slug: string | null | undefined }
  | (SlugBearingShelf & { unitId: string; slug: string | null | undefined });

function unitHref(input: UnitHrefInput): string;
```

Examples:

```ts
unitHref({ type: 'USER',  unitId: 'u-1', slug: 'alice' })            // → '/u/alice'
unitHref({ type: 'USER',  unitId: 'u-1', slug: null })               // → '/user/u-1'
unitHref({ type: 'REALM', unitId: 'r-9', slug: 'rezics' })           // → '/r/rezics'
unitHref({ type: 'TAG',   unitId: 't-3', slug: 'sci-fi' })           // → '/t/sci-fi'
unitHref({                                                            // → '/u/alice/shelf/favorites'
  type: 'SHELF', ownerType: 'USER',
  ownerSlug: 'alice', ownerUnitId: 'u-1',
  unitId: 's-7',     slug: 'favorites',
})
unitHref({                                                            // → '/shelf/s-7'
  type: 'SHELF', ownerType: 'USER',
  ownerSlug: null,  ownerUnitId: 'u-1',
  unitId: 's-7',    slug: null,
})
```

`useUnitHref` is a one-line wrapper over `unitHref` that takes a `unit` object directly and returns the string. It exists so a component can write `<Link to={useUnitHref(post.author)}>` without destructuring.

**Why pure function over hook-only:** route loaders, prefetchers, search-result link generators, and tests all need to compute hrefs outside React. A pure function works everywhere; a hook works only inside components. The hook is sugar, not a substitute.

**Alternatives considered:**

- *Per-type helpers (`userHref`, `tagHref`, …)*: rejected — too much surface, callers usually know the type from the DTO and a discriminated union keeps the call site terse.
- *Inline conditionals at each call site (`user.slug ? '/u/'+slug : '/user/'+id`)*: rejected — that's the status quo and is exactly what drifts. Centralization is the point.
- *Embedding the rule inside `<Link>` itself (an enhanced `<UnitLink unit={…}>` component)*: deferred. The helper is a building block that a `UnitLink` component would consume later. Starting with the helper keeps the surface small and lets call sites pick between `<Link to={unitHref(…)}>` and the future `<UnitLink unit={…}>` ergonomic without lock-in.

### Decision 2: Sub-resource hrefs accept owner context, not just the sub-resource DTO

System shelves can be linked as `/u/<ownerSlug>/shelf/<shelfSlug>` only when both the owner USER unit has a slug *and* the shelf carries its system slug. If either is missing, the link falls back to `/shelf/<shelfUnitId>`. `unitHref` needs the owner's slug+unitId to make this decision, so the SHELF variant of the input takes `ownerSlug` and `ownerUnitId`. Call sites holding a `ShelfDetailDTO` typically also hold the owner UserDTO (or can read it from the page context), so this is ergonomic in practice.

**Why not infer owner from a contained reference:** `ShelfDetailDTO` carries `ownerUnitId` but not necessarily `ownerSlug`. Forcing the helper to fetch or look up the owner slug pulls in the client-cache concern that this change explicitly defers. Passing the owner triple keeps the helper pure.

**Future**: when `slug-client-resolver` lands, a thinner SHELF input variant `{ type: 'SHELF', unitId, slug, ownerUnitId }` becomes viable — the cache provides `ownerSlug`. Until then, the explicit-owner input is required.

### Decision 3: `/user/me/*` is retained as viewer-relative shorthand for settings and privacy surfaces

`/user/me`, `/user/me/setting/profile`, `/user/me/bookmark`, `/user/me/follow`, `/user/me/reaction`, `/user/me/edit` are not "wrong" under the slug-first rule because their identity is "the viewer," not "user <X>." They serve a different purpose from the public profile link. The rule applied:

- **Public profile destination** (header AccountMenu profile entry, "view profile" buttons, author links): render `unitHref({ type: 'USER', ... })` against the viewer. Never link to `/user/me` (the bare profile entry) from the UI.
- **Settings, privacy, edit-self surfaces** (header AccountMenu settings entry, "edit my profile" buttons, "my bookmarks", "my reactions"): continue to link to `/user/me/setting/*`, `/user/me/edit`, `/user/me/bookmark`, etc. Their semantics are owner-bound, and slugging them would make them resolvable as public pages, which they are not.

The redirect at `routes/_mainLayout/user/me/index.tsx` is retained for deep-link convenience (bookmarks, hand-typed URLs) but the UI no longer originates `/user/me` (without a tail) as a destination.

### Decision 4: Spec delta on `public-short-routes`, not a new capability

The new requirement is a UI policy that constrains existing routes; it does not introduce new substrate, endpoints, or contract types. Adding it to `public-short-routes` keeps related requirements colocated — route-shape rules and link-build rules belong together.

The delta is purely **ADDED Requirements**; no existing requirement is modified or removed.

### Decision 5: Query rule is documented but not actively migrated

The proposal acknowledges that data queries already prefer unitId. The change includes one task — an audit — that walks every slug-route loader and confirms that downstream queries consume the resolved `unitId` from the loader DTO rather than re-resolving the slug. If any callsite is found redundantly re-resolving, it is fixed inline. No new helper or convention is added for the query side.

## Risks / Trade-offs

- **[Risk] Audit incompleteness — a stray hardcoded `/user/$userId` slips through.** → Mitigation: the audit task lists each known callsite explicitly (see `tasks.md`), and a grep-based pass over `package/app/src` catches the long tail. A follow-on convention-check R-rule (deferred) would prevent regression.

- **[Risk] AccountMenu profile-store gap — `useUserProfileStore.user` may not consistently carry the slug.** → Mitigation: the audit verifies `User` state shape and the auth-bootstrap path. If the slug is not present on the viewer DTO, the helper falls back to `/user/<unitId>` (correct legacy behavior); no regression.

- **[Risk] SHELF helper input shape is verbose at call sites that hold only a shelf DTO.** → Trade-off accepted: the explicit input is the price of keeping the helper pure pre-cache. When `slug-client-resolver` lands, the SHELF input shape can be relaxed.

- **[Risk] Tests that asserted `/user/<uuid>` URLs in snapshots break.** → Mitigation: snapshot updates are expected as part of the migration. The headline `AccountMenu` test (if any) is reviewed and updated explicitly.

- **[Trade-off] Helper lives in `@rezics/ui`, not `@rezics/contract`.** Reason: it builds router-shaped paths that are React-router-specific, and `@rezics/ui` is already the natural home for routing-adjacent primitives (`SafeLink`, `Link`). `@rezics/contract` continues to expose the route param schemas; the helper consumes them via type imports.

- **[Trade-off] No cache means `unitId-only → slug URL` cases (notifications with bare `actorUnitId`, comment authors when the comment payload omits `author.slug`) still render long-prefix URLs.** That's by design for this change. Those cases motivate the follow-on `slug-client-resolver`.

## Migration Plan

1. Land the helper in `@rezics/ui` with unit tests covering all five top-level types and the SHELF variant in both owner-slugged and owner-unslugged states.
2. Land the spec delta on `public-short-routes`.
3. Migrate `AccountMenu.tsx` as the first consumer; verify by manual run + visual check in the browser.
4. Sweep the remaining call sites (listed in `tasks.md`).
5. Run `bun run check:convention` and the existing test suite. Storybook regression check on stories that reference linked units.
6. No rollback procedure needed — this is a pure refactor with the AccountMenu fix; reverting the commit restores prior behavior.

## Open Questions

- Should the helper also expose a "force long-prefix" escape hatch (e.g., for admin tooling that wants to navigate by raw unitId even when a slug exists)? Decision: not in v1. Admin tools that need the unitId form can compose paths directly; the helper is for the public-facing rule.
- Does the AccountMenu settings entry need any change? Decision: no. It continues to link to `/user/me/setting/profile` per Decision 3.
