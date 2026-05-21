## 1. Structure

- [ ] 1.1 Move `package/app/src/entity-detail` page, component, hook, model, and section files into the matching layered folders under `package/app/src/entity`.
- [ ] 1.2 Move `package/app/src/entity-edit/pages/EntityEditPage.tsx` into `package/app/src/entity/pages/EntityEditPage.tsx`.
- [ ] 1.3 Move `package/app/src/entity-self-claim/pages` files into `package/app/src/entity/pages`.
- [ ] 1.4 Keep `package/app/src/entity-picker` unchanged as the separate reusable picker feature.

## 2. Imports And Exports

- [ ] 2.1 Update relative imports inside moved Entity files to match the consolidated folder layout.
- [ ] 2.2 Update `package/app/src/entity/index.ts` to export Entity shared UI and Entity page entry components required by routes.
- [ ] 2.3 Update route lazy imports under `_mainLayout/entity`, `_mainLayout/e`, and `_mainLayout/user/me/entities` to import from the consolidated Entity feature or route-specific entry files inside it.
- [ ] 2.4 Run a repo-wide search for `@/entity-detail`, `@/entity-edit`, and `@/entity-self-claim`, then migrate all remaining callsites.

## 3. Cleanup

- [ ] 3.1 Remove obsolete `package/app/src/entity-detail`, `package/app/src/entity-edit`, and `package/app/src/entity-self-claim` folders after imports are migrated.
- [ ] 3.2 Confirm `package/app/src/entity-picker` still imports only the Entity shared UI it needs from `@/entity`.
- [ ] 3.3 Confirm `models/` files in the consolidated Entity feature do not import React, hooks, or state modules.

## 4. Validation

- [ ] 4.1 Run `bun run check:convention`.
- [ ] 4.2 Run `bun run format:check`.
- [ ] 4.3 Run the affected app TypeScript/test command available in the repo, or document why no targeted app verification command exists.
- [ ] 4.4 Verify the existing Entity detail, slug detail, edit, my-entities, and new-entity routes still resolve with the same route params.
