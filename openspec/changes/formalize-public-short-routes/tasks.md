## 1. Contract

- [ ] 1.1 Create `package/contract/src/public-route.ts` with TypeBox schemas for `publicUserSlugRouteParamsSchema`, `publicUnitSlugRouteParamsSchema`, `publicUnitIdRouteParamsSchema`, and `publicUnitResolverSearchSchema`.
- [ ] 1.2 Add JSDoc to each public route schema documenting its canonical browser path, resolved identity namespace, and forbidden fallback namespace.
- [ ] 1.3 Export the public route schemas from the `@rezics/contract` public barrel.
- [ ] 1.4 Add contract tests or schema validation coverage for accepted `view=auto`, accepted `view=unit`, omitted `view`, and rejected invalid Unit resolver search values.

## 2. API Client Alignment

- [ ] 2.1 Keep `unitApi.get(unitId)` on `GET /unit/:unitId` and document in code comments that it is id-primary API access, not public route construction.
- [ ] 2.2 Keep `unitApi.getBySlug(unitSlug)` on `GET /unit/by-slug/:unitSlug` and align query key naming with `unitSlug` terminology.
- [ ] 2.3 Review `realm`, `zone`, `tag`, and `user` by-slug query helpers for param names (`realmSlug`, `zoneSlug`, `tagSlug`, `userSlug`) and update touched names without changing endpoint behavior.

## 3. Unit Resolver Routes

- [ ] 3.1 Add a TanStack Router route for `/unit/$unitSlug` that validates params/search with the new contract schemas.
- [ ] 3.2 Move existing id resolver behavior from `/unit/$unitId` to `/unit/id/$unitId`.
- [ ] 3.3 Implement shared Unit resolver logic that accepts a resolved Unit from either slug or id lookup, applies `canAccessUnit`, and decides between typed redirect and generic Unit rendering.
- [ ] 3.4 Implement `?view=unit` behavior so both slug and id resolver routes render the generic Unit page without typed redirect.
- [ ] 3.5 Preserve default `view=auto` behavior so both slug and id resolver routes redirect to typed destinations when `buildUnitUrl(unit)` returns one.
- [ ] 3.6 Ensure slug resolver misses return 404 and do not fall back to id lookup.
- [ ] 3.7 Ensure id resolver misses return 404 and do not fall back to slug lookup.

## 4. Public User Route

- [ ] 4.1 Add `/u/$userSlug` as the canonical public user profile route using `publicUserSlugRouteParamsSchema`.
- [ ] 4.2 Resolve `/u/$userSlug` through the user by-slug API/query helper only, with no Unit slug fallback.
- [ ] 4.3 Update user profile links that have a user slug available to prefer `/u/$userSlug`.

## 5. Typed Route Integration

- [ ] 5.1 Update `buildUnitUrl` or its successor to prefer slug-based typed public routes when a supported typed route exists and the Unit has a slug.
- [ ] 5.2 Keep id-based typed routes as migration fallback for Units without slugs or types without canonical typed slug routes.
- [ ] 5.3 Decide during implementation whether existing `/z/:slug`, `/zone/:slug`, `/realm/:realmId`, and `/tag/:unitId` frontend routes are canonical, redirects, or compatibility routes, and encode that decision in route tests.

## 6. Migration

- [ ] 6.1 Use `rg` to find internal app links and navigations to `/unit/$unitId`, `/unit/${unitId}`, or route objects targeting `/unit/$unitId`.
- [ ] 6.2 Replace generic Unit id navigation with `/unit/id/$unitId`.
- [ ] 6.3 Replace generic Unit slug navigation opportunities with `/unit/$unitSlug` where the caller has a Unit slug.
- [ ] 6.4 Add compatibility redirect handling for legacy UUID-shaped `/unit/:unitId` traffic if the route tree can distinguish it without violating the no mixed id-or-slug resolver rule.

## 7. Tests and Validation

- [ ] 7.1 Add route tests for `/unit/:unitSlug` default typed redirect, `/unit/:unitSlug?view=unit` generic rendering, slug miss 404, and no id fallback.
- [ ] 7.2 Add route tests for `/unit/id/:unitId` default typed redirect, `/unit/id/:unitId?view=unit` generic rendering, id miss 404, and no slug fallback.
- [ ] 7.3 Add route tests for `/u/:userSlug` success and no Unit slug fallback.
- [ ] 7.4 Run targeted app tests for Unit resolver, user profile route, and `buildUnitUrl` changes.
- [ ] 7.5 Run contract package tests or type checks covering new public route exports.
- [ ] 7.6 Run the relevant frontend route generation/build command and fix generated route tree fallout.
- [ ] 7.7 Run `openspec status --change formalize-public-short-routes` and confirm the change remains apply-ready.
