---
title: Document title contract
status: done
created: 2026-06-16
completed: 2026-06-16
supersededBy:
tags: [app, routing, title]
---

## Why
Browser titles currently mix entity titles, translated tab labels, route params,
and a global product suffix. This lets stale titles survive route transitions
and makes pages such as book info or realm-framed posts render as `資訊`,
`book_tabs_info`, IDs, or breadcrumb-like strings.

The app needs one title contract object and one renderer. Routes should describe
the current title subject, its unit kind, and optional display contexts; only the
renderer decides which unit kinds are visible in the title.

## Durable constraints & decisions
- (type) A document title is `DocumentTitleContract`, not a free list of strings:
  `{ subject: { title, unitKind }, contexts?: [{ title, unitKind }] }`.
- (type) The renderer uses ` : ` as the only separator.
- (type) Unit kind visibility is policy-driven. `book` renders its unit-kind
  label, while `post` is hidden; other kinds are explicit in the policy and
  hidden unless intentionally enabled.
- (test) IDs, slugs, route ids, i18n keys, tab labels, and the default `Rezics`
  suffix must not appear in entity document titles.
- (test) Contexts are independent title parts. A realm-framed post renders
  `post title : r/realm title`; a zone-framed post renders
  `post title : z/zone title`.
- (comment) Product title is an explicit product contract only for pages without
  a content subject; it is not an automatic suffix.

## 1. Contract and Renderer
- [x] 1.1 Replace string-list title helpers in `package/app/src/core/routing/documentTitle.ts` with `DocumentTitleContract`, unit-kind policy, and a single renderer.
- [x] 1.2 Make title extractors return human titles only; no id/slug/i18n-key/product fallback.
- [x] 1.3 Update `documentTitle.test.ts` to lock separator, unit-kind policy, hidden post kind, contexts, and forbidden fallbacks.

## 2. Route Migration
- [x] 2.1 Update all app route `head` functions to pass a `DocumentTitleContract` or explicit product contract instead of free string parts.
- [x] 2.2 Remove tab/action labels from entity-backed document titles; book tabs render from the book subject, realm tabs from the realm subject, zone tabs from the zone subject.
- [x] 2.3 Keep realm/zone post route loaders complete so post titles can be combined with human context titles.

## 3. Verification
- [x] 3.1 Run focused document title and context tests.
- [x] 3.2 Run app build plus i18n/convention checks.

## Out of scope
- Changing visible in-page headings, tab labels, navigation labels, or route
  paths.
