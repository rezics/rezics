## Why

The public URL surface defines two prefix families: short prefixes (`/u/`, `/r/`, `/t/`, `/z/`, `/e/`) for slug-bearing units and long prefixes (`/user/`, `/realm/`, …) for unitId addressing. `public-short-routes` already mandates that short=slug is the canonical browser-facing form, but the application's link builders do not yet honor that rule. The header AccountMenu profile entry, for example, links to `/user/me` which redirects to `/user/<unitId>/...` even when the viewer carries a USER slug, putting unitId URLs in the address bar and browser history where slug URLs were intended. The same drift exists wherever a slug-bearing unit is linked from a UserDTO, RealmDTO, TagDTO, ZoneDTO, EntityDTO, or system-shelf reference.

## What Changes

- Introduce `unitHref({ type, unitId, slug })` in `@rezics/ui` as the single sanctioned helper for building public hrefs to slug-bearing unit types. The helper returns a typed TanStack Router path: short-prefix slug URL when `slug` is non-null, long-prefix unitId URL otherwise.
- Add `useUnitHref(unit)` thin wrapper for React call sites that read the unit from props/state; the helper itself stays pure so route loaders and non-React code can use it.
- Refactor `AccountMenu.tsx` to use `unitHref` against the viewer's profile (read from `useUserProfileStore`). The profile menu item now renders `/u/<viewer-slug>` when the viewer has a slug, `/user/<viewer-unitId>` otherwise.
- Audit and migrate existing link-build sites for slug-bearing types — `UserHoverPreview`, `ProfileBasicInfo`, `SettingsTabBar`, `AuthorInfo`, `PostAuthorHeader`, `ExcerptDetail`, `FollowersTabSection`, `MyEntitiesPage`, `NewEntityPage`, `UnitPage`, and any other component that today hardcodes `/user/$userId` or its sibling long-prefix paths.
- Preserve `/user/me/*` viewer-relative routes (`/user/me/setting/profile`, `/user/me/bookmark`, `/user/me/follow`, `/user/me/reaction`, `/user/me/edit`) as a fixed shorthand. They redirect to the canonical form on visit when the target is a public page; settings and privacy surfaces continue to link to `/user/me/...` because the route identity is "the viewer" rather than a specific public unit.
- Stop generating `/user/me` (without the `/setting/...` tail) from link builders: the AccountMenu profile entry resolves at render time to the canonical slug/unitId form. The `/user/me/` redirect route is retained for deep-link convenience (bookmarks, external links) but is no longer linked to from the UI.
- Update `public-short-routes/spec.md` with a new requirement codifying the link-builder rule: short-prefix slug URLs are rendered when a slug is known, long-prefix unitId URLs otherwise; long-prefix URLs SHALL NOT be rendered when a slug is known.
- **Out of scope**: any client-side slug↔unitId cache, reverse lookup from a bare unitId without an embedded slug, chained slug resolution, or DTO-walking middleware. Those land in a follow-on change `slug-client-resolver`. This change only consumes slugs that are already present in the DTOs available at the link-build site.
- **Out of scope**: server-side rename redirects (301 from old slug to new slug). Stale links continue to 404 as today.
- **Query rule** is not changing — it is documented and audited: data queries already prefer unitId-keyed endpoints; the audit confirms no callsite redundantly re-resolves a slug it already turned into a unitId.

## Capabilities

### New Capabilities

(none — this change reuses existing capabilities and adds one new requirement to an existing spec.)

### Modified Capabilities

- `public-short-routes`: adds the link-builder rule (short-prefix slug URL when slug is known; long-prefix unitId URL otherwise; long-prefix URLs never rendered when slug is known). Existing route-resolution requirements are unchanged.

## Impact

- **Affected packages**:
  - `package/ui` — new `unitHref` pure function plus optional `useUnitHref` hook.
  - `package/app` — every link-build site for slug-bearing units migrates through the helper; `AccountMenu` is the headline fix.
  - `package/contract` — no API surface change; existing `publicUserRouteParams`, `publicRealmRouteParams`, etc. continue to be the routing-side schemas.
  - `package/server` — no change.
  - `package/api` — no change.
- **Backward compatibility**: per the project's dev-stage policy, this is a one-shot cutover. Old hardcoded `/user/$userId` links are rewritten in place. `/user/me/*` viewer-relative routes remain; the only behavioral change is that the AccountMenu and similar surfaces no longer render `/user/me` (without a tail segment) as the profile destination — they render the canonical form instead.
- **Storybook / docs**: `unitHref` gets a brief usage note in the `@rezics/ui` Storybook foundation pages so contributors know where to look.
- **Convention check**: a future R-rule could flag raw `<Link to="/user/$userId">` outside of helpers and route definitions, but that lint addition is deferred to a follow-on (it requires per-file allowlists for the route folder itself).
- **Migration risk**: low. Each callsite migration is local and mechanical; the helper accepts the same `{ unitId, slug, type }` triple that the DTOs already carry.
