## Why

The `entities` Meilisearch index already exists and is used by entity search, EntityPicker, and federated search, but the root-only Meili admin surface does not expose the same maintenance operations available for content, feedbacks, users, posts, and realms. This leaves entity search without a UI/API path for explicit drift repair after imports or projection changes.

## What Changes

- Add root-only `/meili/entities/sync` and `/meili/entities/deleteAll` admin endpoints.
- Expose matching `@rezics/api` admin wrappers and React Query mutations.
- Add entities init, full sync, and delete-all controls to the admin `/meili` page.
- Update reset warnings so `entities` is listed with the other managed indexes.

## Impact

**Affected packages:**

- `@rezics/server` — Meili admin route and service parity for the entities index.
- `@rezics/api` — Admin client wrappers and mutations.
- `@rezics/admin` — Meili admin UI controls.

**Migration:** No database migration. Existing entity create/update/delete targeted sync remains unchanged.
