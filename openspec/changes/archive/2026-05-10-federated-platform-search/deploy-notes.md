# Deploy notes — federated-platform-search

Apply order. Each step is independently safe to roll back; legacy per-index search endpoints remain mounted throughout.

## (a) Ship `containedUnitIds` schema/code

- Deploy server build with the updated `package/search/src/sync.ts` (`buildContentDocument` projects `containedUnitIds` for SHELF units) and `package/server/src/shelf/shelf.service.ts` partial-resync hooks (`addItem`/`removeItem`).
- The new `ShelfService` writes will start emitting partial updates to Meilisearch immediately. Pre-existing SHELF documents lack the field until step (c)+(d).

## (b) `initContentIndex` settings update

- Run `initContentIndex` against the production Meilisearch instance. This adds `containedUnitIds` and (re-)confirms `userId` in `filterableAttributes`.
- The settings update is a Meilisearch task; wait for it to finish before backfilling. Meilisearch will reject filter expressions referencing `containedUnitIds` until this completes.

## (c) SQL backfill

- Run `bun run package/server/src/script/backfill-contained-unit-ids.ts` (cursor-paged, idempotent).
- Verifies via `SELECT COUNT(*) FROM "Unit" u WHERE u.type = 'SHELF' AND u.status = 'PUBLISHED'` matching the document count in Meilisearch with `containedUnitIds` defined.

## (d) `syncAllContainedUnitIds` partial resync

- Run `bun run package/server/src/script/resync-content-contained-units.ts` to re-emit partial updates for any SHELF units that were edited between (a) and (c).
- This is a belt-and-braces step; idempotent.

## (e) Federated endpoint server deploy

- Deploy the server build that mounts `POST /meili/search/federated` (`package/server/src/meili/search/federated.api.ts`).
- Smoke-test:
  - `curl -X POST .../meili/search/federated -d '{"scope":{"kind":"global"},"category":"all","query":{"keyword":"test"}}'` — expect a `kind: "grouped"` response with sections.
  - `curl -X POST .../meili/search/federated -d '{"scope":{"kind":"book","unitId":"<id>"},"category":"reviews","query":{}}'` — expect a `kind: "single"` response filtered to that book.

## (f) Frontend pages + header submit deploy

- Deploy the app build with the new scoped routes (`/search`, `/book/:bookId/search`, `/realm/:realmId/search`, `/u/:userSlug/search`, `/user/:userId/search`) and updated header search submit.
- Legacy URLs continue to resolve (no removed routes); the change adds new routes and rewires header submit to scope-aware paths.

## Rollback

- Rolling back (f) reverts the frontend to the previous header-submit behaviour and removes the scoped routes; the federated endpoint stays up but is uncalled.
- Rolling back (e) removes the federated endpoint; the frontend will surface 404s on `/meili/search/federated` calls. Roll back (f) first if rolling back (e).
- Rolling back (a)–(d) is unnecessary on a forward path; the `containedUnitIds` field is additive.
