---
title: UX → Structure Alignment Audit (similar experiences, similar code)
status: active
created: 2026-06-08
completed:
supersededBy:
tags: [app, architecture, conventions, refactor, ux]
---

## Why

`ux/` maps every user experience to the code path it travels (route → feature
page → `@rezics/api` → server domain → `@rezics/contract`). It also reveals that
experiences cluster into **families**: an experience that looks/behaves like
another should be built the same way. The guiding principle for this work:

> Similar user experiences should have similar code structure.

This audit uses the `ux/` family map to find where members of the same family
**diverge structurally** without a behavioral reason, names a **reference
exemplar** per family, and lists ranked, file-level alignment work. The first
slice is a **pilot refactor** to prove the pattern before any broad sweep.

Method note: the family matrix below is built from a directly-verified directory
fingerprint and from reading the contested `index.ts` files. Claims about page
*composition* (e.g. "RealmPage is a monolith", "BookDetailLayout owns a Shell")
came from a read-only scan and are marked **(scan — verify at apply)**; confirm
by reading the cited file before refactoring it.

## Findings

### Reference exemplars (the "done right" cases)

- **Settings sub-pages — gold standard.** Ten routes under
  `routes/_mainLayout/user/me/setting/*` each `lazyRouteComponent` → exactly one
  `Settings<X>Section` in `user/sections/`. Uniform, no exceptions. This is the
  target shape for "N parallel sub-experiences".
- **Entity-detail-with-tabs.** Two independent, clean implementations of one
  pattern (Layout owns data/context → Shell owns tab-nav + `<Outlet/>` → thin
  per-tab route files): `book-library` (`BookDetailLayout` + `BookDetailShell`)
  and `user` (`ProfileLayout` + `ProfileShell`). (scan — verify at apply)
- **Engagement item.** `review` ↔ `remark` are near-identical: `models/` +
  `components/{detail,item,list}` + `forms/` + `sections/{Detail,List}` + `pages/`.
- **Library landing + search.** `book-library`: `Page → Section (list +
  pagination + sortControl) → ListView` + shared `search/` filter primitives.

### Verified container fingerprint (app features)

`✓` = container dir present. Subdirs shown for `components/`.

| feature | models | hooks | utils | states | components | sections | pages | forms | components/ subdirs |
|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|---|
| book-library | ✓ | ✓ |  | ✓ | ✓ | ✓ | ✓ |  | BookDetail, BookList, BookSearch, item, list, Chapter, … |
| game-library | ✓ |  |  |  |  |  | ✓ |  | — (stub) |
| media-library | ✓ |  |  |  |  |  | ✓ |  | — (stub) |
| review | ✓ |  |  |  | ✓ | ✓ | ✓ | ✓ | detail, item, list, ReviewSearch |
| remark | ✓ |  |  |  | ✓ | ✓ | ✓ | ✓ | detail, item, list |
| poll | ✓ | ✓ |  |  | ✓ | ✓ | ✓ |  | — (flat) |
| post | ✓ |  |  |  | ✓ | ✓ | ✓ | ✓ | detail, item, parts |
| comment | ✓ | ✓ |  |  | ✓ | ✓ | ✓ | ✓ | item, parts |
| realm | ✓ |  |  |  | ✓ | ✓ | ✓ |  | — (flat) + non-allowlist `setting/` |
| shelf | ✓ | ✓ |  | ✓ | ✓ | ✓ | ✓ |  | — (flat) |
| collection |  | ✓ |  |  | ✓ |  |  |  | — |
| user | ✓ | ✓ |  | ✓ | ✓ | ✓ | ✓ |  | — |
| dashboard | ✓ |  |  |  | ✓ | ✓ | ✓ |  | — |
| progress | ✓ |  |  |  |  |  | ✓ |  | — |
| progress-status | ✓ | ✓ |  | ✓ | ✓ | ✓ |  |  | — |
| bookshelf-view | ✓ |  |  |  | ✓ |  |  |  | — |
| unit | ✓ | ✓ |  |  | ✓ |  | ✓ |  | UnitPicker |
| excerpt | ✓ |  |  |  | ✓ | ✓ | ✓ |  | detail, item, list, source |
| entity | ✓ | ✓ |  |  | ✓ | ✓ | ✓ |  | — |
| zone | ✓ | ✓ |  |  |  |  | ✓ |  | uses `templates/` instead |
| search | ✓ | ✓ | ✓ |  | ✓ | ✓ | ✓ |  | primitive |
| inbox | ✓ |  |  |  | ✓ | ✓ | ✓ |  | — |
| feedback |  |  |  |  | ✓ |  | ✓ |  | — |
| staff |  |  |  |  |  |  | ✓ |  | — (pages only) |
| create | ✓ |  |  |  | ✓ |  | ✓ |  | — |
| book-edit | ✓ | ✓ |  |  | ✓ | ✓ | ✓ |  | Metadata |
| tag |  | ✓ |  |  | ✓ |  | ✓ |  | Edit |

### Cross-cutting finding #1 — `index.ts` public-export discipline is ad-hoc

The feature standard makes `index.ts` the sole public export and requires
external consumers to go through it. In practice every feature exports a
different arbitrary slice and routes/features deep-import internals. Verified:

- `review/index.ts` → `ReviewCard`, `HorizontalReviewCarousel`, `ReviewList`,
  2 models. **No pages, no detail, no forms, no sections.**
- `remark/index.ts` → `RemarkListSection`, `RemarkInlineForm`, `RemarkList`.
  A *different* slice from its twin `review`, despite identical structure.
- `shelf/index.ts` → 3 pages (`ShelfPage`, `ShelfEditPage`, `ShelfByBookPage`)
  but **not** `ShelfListPage` / `ShelfSearchPage` / `NewShelfPage`.
- `user/index.ts` → auth modals/hooks/stores but **not** the profile
  pages/sections (routes deep-import those).

There is no canonical answer to "what does a feature expose?". Picking one
policy and applying it is the single most pervasive, lowest-risk lever — but the
policy itself is a decision (see Durable constraints).

### Cross-cutting finding #2 — non-allowlist container `realm/setting/`

`realm/` carries a `setting/` directory that is not in the documented container
allowlist. Either fold it into `sections/` (or `components/`) or extend the
allowlist in `check:convention` with a rationale.

### By-design divergences (explicitly NOT to "align")

- **poll** — survey instrument: immutable after creation, embedded in posts, not
  an indexed list item. Flat components + no `forms/`/`detail/item/list` is
  correct. Do not force the engagement-item triad onto it.
- **comment** — threaded tree: `CommentTreeList`/rails/promotion sections are
  intrinsic; it is not a flat list and should not be reshaped into one.
- **post** — thread root: `components/parts/` for shared rendering + list-as-section
  is justified.
- **unit**, **book-read-node** — raw-data detail and reader surfaces; no tab shell
  needed unless they grow tabs.
- **bookshelf-view**, **policy** — pure render/util layers (no pages/sections by intent).

### Ranked actionable divergences (behavioral reason absent)

1. **realm detail is a monolith, not the tabbed-detail shell** (scan — verify):
   `RealmPage` renders inline `<Tabs>` with callback-driven nav and no per-tab
   route files, while the same UX family (`book` detail, `user` profile) uses
   Layout + Shell + `<Outlet/>` + thin route sub-pages. Highest-signal alignment
   in a core family.
2. **`index.ts` export discipline ad-hoc across all features** (verified, §#1).
   Pervasive, low-risk, but needs a policy decision first.
3. **game-library / media-library are stubs** of a built-out family member
   (`book-library`): same "library landing" UX, only `models/` + `pages/`, single
   `t()` page, no list/search. Either scaffold to the reference or record them as
   intentionally deferred.
4. **review ↔ remark asymmetry**: divergent `index.ts` slices (§#1) and
   variant gaps (`ReviewCardPair` / `HorizontalReviewCarousel` have no remark
   twin). Smallest, safest alignment; the cleanest place to demonstrate the rule.
5. **No shared list/search abstraction**: `review`/`shelf`/`realm` search are
   keyword-only and inline; `book`/`zone`/`search` use `AdvancedSearch`. Extract a
   shared `ListSection`/search shape rather than re-implementing per feature.
6. **forms/ adoption inconsistent**: `review`/`remark`/`post`/`comment` have
   `forms/`; `realm`/`shelf`/`entity`/`excerpt` inline forms in pages. No policy.
7. **`ShelfEditPage` not `lazyRouteComponent`** (scan — verify): the lone editor
   route that direct-imports while all siblings lazy-load.
8. **personal-library fragmentation** (`collection`/`progress`/`progress-status`/
   `shelf`/`bookshelf-view`): architecture-level ownership question, higher risk —
   audit-only for now.

## Durable constraints & decisions

- (comment) "Similar UX → similar code": a feature in a UX family must adopt that
  family's reference structure unless a behavioral reason is recorded at the
  divergence site. The by-design list above are the recorded exceptions.
- (comment) Entity-detail-with-tabs family uses Layout (data/context) + Shell
  (tab-nav + `<Outlet/>`) + thin per-tab route files. `book-library` and `user`
  are the exemplars.
- (comment) Engagement-item family uses `models/{policy}` +
  `components/{detail,item,list}` + `forms/` + `sections/{Detail,List}`. `review`
  and `remark` are the exemplars.
- (decision — needs user input) Canonical `index.ts` export policy. Options:
  (a) expose route pages + cross-feature-reused components, hide everything else;
  (b) expose only what another feature already imports, enforced by `knip`.
  Pick one before the §#1 sweep.
- (comment) `poll` deliberately does not implement the engagement-item triad
  (immutable survey, embedded, not list-indexed).
- (test) Any structural refactor preserves existing routes and behavior — this is
  a code-shape change, not a feature change.
- (comment) Container directory names must stay within the `check:convention`
  allowlist; `realm/setting/` either moves into an allowlisted container or the
  allowlist is extended with a rationale.

## Tasks

## 0. Pilot — realm detail → tabbed shell (DONE)

Aligned the realm detail to the entity-detail-with-tabs family (`book`, `profile`):
the 360-line monolithic `RealmPage` became `RealmDetailLayout` (data + header +
`RealmDetailProvider` context) → `RealmDetailShell` (tab nav as route links) →
path-based tab sub-routes, each reading shared state via `useRealmDetail`. Tab
state moved from a `?tab=` search param to the path, matching the reference.

- [x] 0.1 Verified the realm composition by reading `RealmPage.tsx`, its routes,
  and the `book`/`profile` exemplars.
- [x] 0.2 Refactored: new `realm/pages/{RealmDetailLayout,realmDetailContext}`,
  `realm/sections/{RealmDetailShell,RealmFeedTab}`; pathless `_detail` layout +
  `_detail/{index,wiki,tags,about,members}` routes; `realmTagFeedSearch` dropped
  the `tab` field; deleted `RealmPage.tsx` + its route + story; migrated the
  story to `RealmDetailLayout.stories.tsx`. Bilingual comments at each shell.
- [x] 0.3 Verified: 28 realm tests pass, `check:convention` 0 violations,
  `check:tokens` 52/52, Biome-clean (14 files), `tsc` 0 errors in pilot files,
  `vite build` regenerates `routeTree.gen.ts` with clean tab URLs.

Routing notes for the rest of the family:
- (decision) A pathless `_detail.tsx` layout wraps only the detail tabs; non-tab
  siblings (`manage`/`create`/`search`/`post`) stay outside it without moving.
  This is the template for converting other monolithic tab pages to sub-routes.
- (comment) `routeTree.gen.ts` has no standalone generator wired here; regenerate
  it with `task app:build` (`bun vite build`) — the `@tanstack/router-plugin`
  runs at build start (~7s, idempotent). The standalone `@tanstack/router-generator`
  fails on a transitive version skew, so do not invoke it directly.

## 1. index.ts export-discipline sweep (after policy decision)

- [ ] 1.1 Record the chosen export policy as a `check:convention` rule.
- [ ] 1.2 Normalize each feature's `index.ts` to the policy; replace deep imports
  in `routes/**` and cross-feature consumers with feature-root imports.

## 2. Library family (game/media → book-library reference)

- [ ] 2.1 Decide: scaffold `game-library`/`media-library` to the reference, or
  mark them intentionally deferred in code.
- [ ] 2.2 If scaffolding: add `components/{list,item}` + `sections` list section +
  search wiring mirroring `book-library`.

## 3. Shared list/search abstraction

- [ ] 3.1 Extract a shared list-section + search shape; adopt in
  `review`/`shelf`/`realm` search pages.

## 4. Minor alignments

- [x] 4.1 Made `_editor/shelf/$shelfId/edit` route `lazyRouteComponent` the page
  (deep dynamic import `@/shelf/pages/ShelfEditPage`), matching every other editor
  route; dropped the now-dead `ShelfEditPage` barrel export from `shelf/index.ts`.
  Verified: 84 shelf+realm tests pass, tsc 0 new errors, Biome-clean. (Confirmed
  `book/.../edit/history.tsx`'s direct import is an intentional `<Outlet/>` layout,
  not an outlier.)
- [ ] 4.2 Resolve `realm/setting/` container (move or extend allowlist).
- [ ] 4.3 Decide `forms/` extraction policy; apply to inline-form features.

## Out of scope

- Behavioral/feature changes (this is shape-only).
- Reshaping by-design divergences (`poll`, `comment`, `post`, `unit`,
  `book-read-node`, pure-render layers).
- The personal-library ownership re-architecture (#8) — audit-only this pass.
