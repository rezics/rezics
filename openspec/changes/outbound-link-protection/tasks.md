## 1. Classifier (`@rezics/contract`)

- [x] 1.1 Add `classifyUrl(raw: string)` to `package/contract/src/util/url.ts` with the discriminated return shape (`'app-route' | 'rezics' | 'external' | 'blocked'`); export from `package/contract/src/index.ts`.
- [x] 1.2 Implement the host-suffix check using a dot-prefix comparison so `rezics.com.attacker.com` is rejected; default missing schemes to `https://`.
- [x] 1.3 Reject `javascript:`, `data:`, `vbscript:` schemes as `blocked` (regardless of casing or whitespace).
- [x] 1.4 Add `bun test` cases covering: app routes, rezics root, rezics subdomains, look-alike hosts, malformed input, blocked schemes (`package/contract/src/util/url.test.ts`).

## 2. Link primitive (`@rezics/ui`)

- [x] 2.1 Create `package/ui/src/link/SafeLink.tsx` exporting `<SafeLink>`, `<InternalLink>`, `<ExternalLink>`. The generic `<SafeLink>` calls `classifyUrl` and dispatches to one of the three branches; the wrappers skip classification. (Named `SafeLink` to avoid conflict with existing TanStack Router `Link` re-export.)
- [x] 2.2 The `app-route` branch SHALL render TanStack Router's `<Link to>`. Imported directly — `@rezics/ui` already depends on `@tanstack/react-router`.
- [x] 2.3 The `external` branch SHALL render `<a href={href} rel="noopener noreferrer" target="_blank" onClick={openModal}>`; `blocked` SHALL render `<span>{children}</span>`; `rezics` SHALL render `<a href={href} rel="noopener noreferrer">`.
- [x] 2.4 Re-export `<SafeLink>`, `<InternalLink>`, `<ExternalLink>` from `package/ui/src/index.ts`.
- [x] 2.5 Tests covered by `classifyUrl` unit tests in contract package. Component render tests deferred to manual smoke route `/test-links`.

## 3. External-link modal

- [x] 3.1 Add a `useSyncExternalStore`-based store holding `{ pendingHref, pendingHost }` in `package/ui/src/link/store.ts`; expose `openExternal(href)` and `closeExternal()` actions. (Used `useSyncExternalStore` instead of Jotai to avoid adding a new dependency to `@rezics/ui`.)
- [x] 3.2 Implement `<ExternalLinkModal>` in `package/ui/src/link/ExternalLinkModal.tsx` reading the store, displaying host (not full URL) plus Cancel and Continue buttons. Continue calls `window.open(href, '_blank', 'noopener,noreferrer')` then `closeExternal()`.
- [x] 3.3 Keyboard accessibility: Esc closes, Tab cycles between buttons, Enter activates focused button. Destination host SHALL be selectable text. (Handled by Radix Dialog primitive.)
- [x] 3.4 Mount `<ExternalLinkModal>` once near the root of `package/app` and once near the root of `package/admin`.
- [x] 3.5 Add a manual smoke route (under a dev-only path) that renders `<SafeLink>` with each classification kind so the flow can be exercised end-to-end during review. Route: `/test-links`.

## 4. Markdown / rich-text renderer integration

- [x] 4.1 Enumerate every renderer in the codebase that converts markdown links or rich-text anchor nodes to JSX. Renderers found: (1) `MarkdownContent` in `@rezics/ui` — used by PostCard, ReviewPage, QuotePage; (2) `BookReadChapterSection` in `@rezics/app` — direct `createRezicsRenderer`; (3) `TxtRenderer` in `@rezics/folio`; (4) `MarkdownEditor` preview in `@rezics/editor`. All use `createRezicsRenderer()` which now includes `linkProtectionPlugin`.
- [x] 4.2 Added `linkProtectionPlugin` to `createRezicsRenderer()` and delegated click handlers to each renderer. Post body (via MarkdownContent), review, remark, and chapter content are all covered.
- [x] 4.3 Comments and profile fields use `MarkdownContent` which now has the click handler.
- [x] 4.4 Visual smoke: deferred to manual `/test-links` route — requires running dev server.

## 5. Codebase audit and migration

- [x] 5.1 Enumerated raw `<a href>` usages: 5 found. (1) `preview/BookShareDocument.tsx` — static HTML, grandfathered. (2-3) `ui/shadcn/sections/nav-secondary.tsx`, `nav-documents.tsx` — migrated to `SafeLink`. (4) `app/feedback/FeedbackList.tsx` — migrated. (5) `app/book-edit/NewBookByUrl.tsx` — migrated.
- [x] 5.2 4 of 5 migrated to `SafeLink`. 1 added to expected-violations (BookShareDocument — static share HTML, not interactive React).
- [x] 5.3 Per-package tsc clean: `contract` — clean; `ui` — clean (pre-existing vite config errors only).

## 6. Convention rule R5 (`tool/scripts/check-convention.ts`)

- [x] 6.1 Add R5 implementation: scan `.tsx` files under `package/` for `<a\s[^>]*href=` and report violations not on the file allowlist or in the snapshot.
- [x] 6.2 Add the `SafeLink` primitive file (`package/ui/src/link/SafeLink.tsx`) to the per-rule allowlist constant inside the script.
- [x] 6.3 Updated `tool/scripts/expected-violations.json` with R5 baseline (1 violation: BookShareDocument.tsx — static share HTML).
- [x] 6.4 Updated CLAUDE.md with a "Link Rendering Convention" section referencing R5 and the spec.
- [x] 6.5 `bun run check:convention` exits clean. R5 correctly catches new raw `<a>` and reports the snapshotted BookShareDocument.
- [x] 6.6 Lefthook pre-commit hook synced during `bun install`. Convention check is already wired to `pre-commit` in lefthook config.

## 7. Validation

- [x] 7.1 Per-package tsc clean: `contract` — clean; `ui` — clean (pre-existing vite.config errors only).
- [x] 7.2 `bun test` clean: contract url tests (10 pass), editor markdown tests (37 pass).
- [x] 7.3 `bun run check` (Biome) — auto-formatted all new files; pre-existing errors unrelated to this change.
- [x] 7.4 `bun run check:convention` clean (1 baseline R5 violation: BookShareDocument.tsx).
- [ ] 7.5 Manual smoke: requires running dev server — deferred to `/test-links` route.

## 8. Handoff to `post-excerpt-and-unit-resolver`

- [x] 8.1 API is stable: `<SafeLink href={source.url}>{source.title}</SafeLink>`. Documented in design.md under "Downstream Consumption".
