## 1. Prerequisite check

- [ ] 1.1 Confirm the `outbound-link-protection` change is merged and `<Link>` is exported from `@rezics/ui`. If not, pause: this change cannot land cleanly without it.

## 2. Contract tightening (`@rezics/contract` + `@rezics/server`)

- [ ] 2.1 Change `postListQuerySchema.kind` in `package/contract/src/post.ts` from `t.Optional(t.String())` to `t.Optional(postKindLiterals)` (using whatever the post-kind literal union is named after the EXCERPT rename in step 3).
- [ ] 2.2 Drop `as PostKind` in `package/server/src/post/post.service.ts` (line ~35); the validated value is already typed correctly.
- [ ] 2.3 Run `cd package/contract && bun run tsc --noEmit` and `cd package/server && bun run tsc --noEmit`.
- [ ] 2.4 The next compile pass surfaces three frontend call sites — keep these in mind for the post-rename touch-up in step 4.6.

## 3. `QUOTE` → `EXCERPT` rename: contract and database

- [ ] 3.1 Rename `PostKind.QUOTE` to `PostKind.EXCERPT` in `package/server/prisma/schema.prisma`. Generate a Prisma migration that renames the enum value.
- [ ] 3.2 In the same migration, add a one-shot data update: `UPDATE "Post" SET "kind" = 'EXCERPT' WHERE "kind" = 'QUOTE'`. (If Prisma's enum-rename does this for you, skip the explicit UPDATE.)
- [ ] 3.3 Document the inverse migration in a comment inside the migration file: `-- inverse: UPDATE "Post" SET "kind" = 'QUOTE' WHERE "kind" = 'EXCERPT'` for runbook purposes only; not auto-applied.
- [ ] 3.4 Update the contract: `postKindLiterals` value union, `PostKind` const enum re-export, all `QUOTE` references in `package/contract/src/post.ts` → `EXCERPT`.
- [ ] 3.5 Run `bun run prisma:generate` and confirm the generated client contains `PostKind.EXCERPT`.

## 4. `QUOTE` → `EXCERPT` rename: backend, app, and tooling

- [ ] 4.1 `package/contract/src/build-url.ts` — rename `case 'QUOTE'` to `case 'EXCERPT'` and change the route from `/quote/:id` to `/excerpt/:id`.
- [ ] 4.2 `package/search` Meili index filter literal: `kind = 'QUOTE'` → `kind = 'EXCERPT'`.
- [ ] 4.3 Server seed and any mocks: `mockQuotes.ts` → `mockExcerpts.ts`, `kind: 'QUOTE'` → `kind: 'EXCERPT'`.
- [ ] 4.4 `package/app` directory rename: `package/app/src/quote/` → `package/app/src/excerpt/`. Component renames inside: `QuoteCard` → `ExcerptCard`, `QuotePage` → `ExcerptPage`, `QuoteEditor` → `ExcerptEditor`, etc.
- [ ] 4.5 Hybrid component renames: `QuoteExcerptList` → `ExcerptList`, `QuoteExcerptPreview` → `ExcerptPreview`, `SingleQuoteExcerpt` → `SingleExcerpt`, and any other `QuoteExcerpt*` names.
- [ ] 4.6 Route tree: `/quote/$unitId` → `/excerpt/$unitId`, `/quote/book/$id` → `/excerpt/book/$id` (or whichever paths exist). Update the TanStack Router route file paths and re-generate any route trees if applicable.
- [ ] 4.7 i18n keys: `quote.*` → `excerpt.*` across the locale JSON/TS files. Use a search-and-replace tool rather than manual edits to avoid missing keys.
- [ ] 4.8 Fix the three lowercase frontend call sites (these were flagged by the contract tightening in step 2):
  - `package/app/src/book-library/page/BookReviewPage.tsx:34` — `"review"` → `PostKind.REVIEW`
  - `package/app/src/book-library/component/BookReviewsPreview.tsx:34` — `'review'` → `PostKind.REVIEW`
  - `package/app/src/book-library/component/RemarkPreview.tsx:21` — `'remark'` → `PostKind.REMARK`
  - (Also fix any analogous `'quote'` lowercase call sites surfaced during the rename — should be zero after the literal-union typing lands.)
- [ ] 4.9 Per-package `bun run tsc --noEmit` across `package/contract`, `package/server`, `package/api`, `package/app`, `package/admin`, `package/search`. Resolve all type errors before moving on.
- [ ] 4.10 `bun run check` (Biome) — confirm formatting and lint clean.

## 5. Excerpt source schema (`@rezics/contract`)

- [ ] 5.1 Add `excerptSourceSchema` to `package/contract/src/post.ts` as a discriminated union: `{ mode: 'unit', unitId, title }` vs `{ mode: 'url', url, title }` with the constraints in the spec (`title`: 1–200 chars, `url`: ≤2048 chars, no domain restriction).
- [ ] 5.2 Add `source: t.Optional(excerptSourceSchema)` to `postExtraSchema`.
- [ ] 5.3 Re-export `excerptSourceSchema` and the inferred `ExcerptSource` type from `package/contract/src/index.ts`.
- [ ] 5.4 Server-side: `post.api.ts` already validates `extra` via the schema — no extra code needed beyond confirming the create/update payload shape now accepts `source`.
- [ ] 5.5 `bun test` for any existing post-validation tests; add a small test confirming both modes pass and a malformed mode (e.g., missing `unitId` in unit mode) fails.

## 6. Excerpt source picker (frontend, in `package/app/src/excerpt/`)

- [ ] 6.1 Create `<ExcerptSourcePicker>` component matching the `composed-editors` spec requirements: URL input as primary affordance, collapsed "Pick from this work" disclosure with a unit tree under `targetUnitId`, controlled props.
- [ ] 6.2 Implement URL classification on input change. If the URL classifies as an in-app `/unit/:id` or a typed-page route mappable back to a unit (use the existing route table or `parseAppRoute` if one exists; create one if not), upgrade the value to `{ mode: 'unit', unitId, title }`.
- [ ] 6.3 Title pre-fill: when auto-upgrade fires or a tree pick happens, fetch the unit's display name (translated) and set `title` to it. Do not overwrite a title the author has manually edited (track a `pristine` flag).
- [ ] 6.4 "Linked to: <name>" affordance when auto-upgrade fires; show once on transition, do not re-flash on every keystroke.
- [ ] 6.5 Tree picker UI: render units rooted at `targetUnitId` using whatever existing tree/list primitives exist in the codebase; fetch via the standard unit-children query.
- [ ] 6.6 Wire the picker into the existing Excerpt editor (the renamed `ExcerptEditor` from step 4.4). Place it adjacent to the body editor.
- [ ] 6.7 Visual smoke: open the Excerpt editor, type a URL, paste a `/unit/:id`, paste a `/book/:id`, expand the tree, pick a chapter — confirm all four paths produce the right value shapes.

## 7. Source rendering (frontend)

- [ ] 7.1 In the post-body renderer (used by Excerpt detail and Excerpt previews), render the source as `<Link href={source.mode === 'unit' ? '/unit/' + source.unitId : source.url}>{source.title}</Link>`. Do not emit raw `<a>`.
- [ ] 7.2 Confirm the `outbound-link-protection` `<Link>` primitive from `@rezics/ui` is imported. R5 convention rule (from that change) catches accidental raw `<a>` use.
- [ ] 7.3 Visual smoke: render an Excerpt with each source mode; confirm unit mode goes through the resolver on click and url mode (external) opens the modal.

## 8. Unit resolver (`package/app/src/unit/`)

- [ ] 8.1 Implement `canAccessUnit(unit, viewer)` helper in `package/app/src/unit/canAccessUnit.ts` (or wherever shared unit-level helpers live). Rules per spec: DELETED → false; DRAFT/PRIVATE/UNLISTED → owner-only; otherwise true.
- [ ] 8.2 Audit existing typed pages (book detail, post detail, shelf detail, etc.) and replace their inline visibility checks with `canAccessUnit`. Per-package `tsc --noEmit` after each.
- [ ] 8.3 Refactor the existing `/unit/:unitId` route: move its current generic-renderer body to a new `/unit/:unitId/view` route. Use whatever route-file convention TanStack Router uses in this repo (likely `package/app/src/routes/unit/$unitId/view.tsx`).
- [ ] 8.4 Replace `/unit/:unitId` with the loader-driven resolver per the spec: ensure `unitQueries.detail`, check `canAccessUnit`, call `buildUrl`, redirect or fall through to `/view`. The route component renders nothing.
- [ ] 8.5 Verify `buildUrl` covers every UnitType expected to have a typed page; add cases for any missing ones (this should already be the case after step 4.1, but confirm).
- [ ] 8.6 Add the redirect-loop integration test in `package/app/src/unit/unitResolver.test.ts` (or under whatever test convention exists). For each UnitType, create a fixture unit, simulate the resolver loader, assert the redirect terminates without revisiting `/unit/:id`.
- [ ] 8.7 Add an access-control test: DELETED → 404; DRAFT for non-owner → 404; DRAFT for owner → redirect proceeds.

## 9. Validation

- [ ] 9.1 Per-package `bun run tsc --noEmit` clean: `package/contract`, `package/server`, `package/api`, `package/app`, `package/admin`, `package/search`.
- [ ] 9.2 `bun test` clean across all touched packages.
- [ ] 9.3 `bun run check` (Biome) clean.
- [ ] 9.4 `bun run check:convention` clean (R5 from `outbound-link-protection` should already pass — confirm no excerpt code introduced raw `<a>`).
- [ ] 9.5 `bun run knip` — no new unused exports introduced.
- [ ] 9.6 Manual smoke against running dev server:
  - Reproduce the original `kind` bug (lowercase value) and confirm the schema now rejects it before reaching Prisma.
  - Create an Excerpt with each source mode (unit picked from tree, URL pasted as in-app, URL pasted as external).
  - Click the source link in each case; confirm unit mode goes through `/unit/:id` resolver and lands on the typed page; url mode (external) shows the confirmation modal.
  - Visit `/unit/:id` for a book → redirects to `/book/:id`. For a unit type without a typed page → redirects to `/unit/:id/view`. For a deleted unit → 404. For a draft unit as non-owner → 404.

## 10. Cleanup and documentation

- [ ] 10.1 Remove any leftover `quote` strings, `Quote*` symbols, or `/quote/` route references with a final repo-wide grep. False positives (e.g., the verb "quote" in user-facing strings) acceptable; code references should be zero.
- [ ] 10.2 Update `CLAUDE.md` if it references PostKind values, route paths, or excerpt-source semantics anywhere.
- [ ] 10.3 Update mocks per CLAUDE.md `// MOCK:` convention if any source data is added with placeholder values.
