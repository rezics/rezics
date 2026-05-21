## Context

`package/app` currently has separate top-level folders for `entity`,
`entity-detail`, `entity-edit`, `entity-self-claim`, and `entity-picker`.
The first four are all Entity page/domain surfaces with a small total footprint,
while `entity-picker` is a reusable dialog used by attribution workflows outside
Entity pages.

The app feature standard expects feature folders to expose public entrypoints
through `index.ts`, keep `models/` pure, and keep feature-internal imports local
where possible. The Entity split currently follows those layers, but the
top-level feature boundaries are too granular for the domain complexity.

## Goals / Non-Goals

**Goals:**

- Consolidate Entity page surfaces into one `package/app/src/entity` feature.
- Preserve the existing route URLs and page behavior.
- Keep `entity-picker` as a separate reusable feature boundary.
- Remove obsolete top-level Entity page feature folders after all internal
  imports are updated.
- Keep app feature layering and convention checks intact.

**Non-Goals:**

- Do not redesign Entity UI.
- Do not change Entity API contracts, DTOs, search behavior, permissions, or
  database schema.
- Do not merge `entity-picker` into `entity`.
- Do not refactor Book feature boundaries.

## Decisions

### Decision: `entity` owns Entity pages and shared Entity UI

Target layout:

```txt
package/app/src/entity/
  components/
  hooks/
  models/
  pages/
  sections/
  index.ts
```

`EntityDetailPage`, `EntityEditPage`, `MyEntitiesPage`, and `NewEntityPage`
belong under `pages/`. Detail-specific presentation such as `EntityHero` belongs
under `components/`; tab sections belong under `sections/`; pure selectors stay
under `models/`; data-composition hooks such as `useEntityWorks` belong under
`hooks/`.

Alternative considered: keep `entity-detail`, `entity-edit`, and
`entity-self-claim` as separate features. This preserves current route-level
entrypoints, but it keeps top-level folder noise for a domain whose page
surfaces are not complex enough to justify separate feature ownership.

### Decision: `entity-picker` remains separate

`entity-picker` remains at `package/app/src/entity-picker` because it is a
reusable input surface for attribution editors and other future entity-linking
flows. It owns picker-specific state, inline create behavior, search ordering,
and Storybook coverage.

Alternative considered: move picker components into `entity/components`. This
would reduce one more top-level folder, but it would make a cross-feature form
control look like an Entity page implementation detail and increase coupling
from attribution flows into the Entity page feature.

### Decision: Route imports should point to the new feature boundary

Existing routes under `_mainLayout/entity`, `_mainLayout/e`, and
`_mainLayout/user/me/entities` should keep their URLs and route params, but
update lazy imports to the consolidated Entity entrypoint or route-specific
entry files under the Entity feature.

If implementation finds that importing from a single `@/entity` barrel combines
too much lazy-loaded code, it may add thin route entry files inside
`package/app/src/entity/pages` or `package/app/src/entity/routes` and import
those directly. The public feature boundary should still remain the single
Entity feature.

### Decision: This is a clear internal cutover

Because the project is in development and there is no public app import API,
the old top-level folders should be removed in the same change. Compatibility
aliases from `@/entity-detail`, `@/entity-edit`, or `@/entity-self-claim` should
not be kept unless a convention or bundling constraint forces a temporary
bridge.

## Risks / Trade-offs

- [Risk] Importing every route from `@/entity` may reduce route-level chunk
  separation. -> Mitigation: use thin route-specific entry files within the
  consolidated feature if bundle boundaries matter.
- [Risk] Moving files can break relative imports or feature-layer rules. ->
  Mitigation: update imports mechanically, then run TypeScript/convention checks.
- [Risk] The refactor may accidentally change UI behavior. -> Mitigation: keep
  edits structural, avoid component rewrites, and verify existing routes render.

## Migration Plan

1. Move Entity detail, edit, and self-claim files into the consolidated
   `package/app/src/entity` layered folders.
2. Update relative imports inside the moved files.
3. Update route lazy imports and cross-feature imports to the new Entity
   feature boundary.
4. Remove obsolete top-level folders once no imports reference them.
5. Run formatting, convention checks, and app type/test checks.

Rollback strategy: revert the structural file moves and route import updates.
No data rollback is required.

## Open Questions

- Should route lazy imports use the `@/entity` barrel for simplicity, or thin
  route-specific entry files inside the consolidated feature for chunk control?
