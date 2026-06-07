---
title: Realm Feed Tag Row Interaction
status: active
created: 2026-06-07
completed:
supersededBy:
tags: [realm, feed, tags, ui]
---

## Why

The realm feed tag row currently behaves like a full horizontal list of every
realm tag. That creates a visible scrollbar, weak drag behavior, and a misleading
`All` chip that clears feed filters even though the full tag surface belongs in
the `Tags` tab.

This change turns the feed row into a bounded shortcut strip: it supports wheel
and pointer-drag horizontal navigation without page scroll bleed, keeps click
selection distinct from drag, shows only a limited set of useful chips, and uses
the final chip as navigation to the complete `Tags` tab.

## Durable constraints & decisions

- (test) Mouse wheel on an overflowing feed tag row scrolls the row horizontally
  and prevents the page from scrolling vertically while the row can consume the
  wheel delta.
- (test) Pointer movement above the drag threshold scrolls the row and suppresses
  the chip click; a pointer press/release without meaningful movement still
  selects or deselects the chip.
- (test) The feed tag row is bounded: selected tags are pinned first, unselected
  shortcut tags are capped, and the full realm tag list is reached through a
  `Tags` tab navigation chip.
- (test) The `All` behavior is not modeled as an unconditional feed filter. The
  full-list action switches to `tab=tags`; clearing selected feed filters remains
  a separate action.
- (comment) The shortcut cap is a feed affordance, not a data limit. Complete
  browsing and hierarchy stay in `RealmTagBrowser` under the `Tags` tab.
- (type) If a reusable scroller helper/component is introduced, its public API
  should model drag-threshold click suppression and wheel-to-horizontal-scroll as
  explicit behavior rather than as realm-specific state.

## Tasks

## 1. Feed Tag Row Model

- [x] 1.1 Update `package/app/src/realm/models/realmFeedTagFilter.ts` so feed
  shortcut ordering pins selected tags first and caps unselected shortcut tags
  to a small fixed count, initially 12.
- [x] 1.2 Add or update model tests for ordering, selected-tag pinning, cap
  behavior, and preservation of selected chips that would otherwise fall outside
  the shortcut cap.

## 2. Row Interaction

- [x] 2.1 Update `package/app/src/realm/sections/RealmFeedTagFilter.tsx` to hide
  the native scrollbar and support wheel-to-horizontal scrolling with vertical
  page-scroll suppression while the row is scrollable.
- [x] 2.2 Add pointer-drag scrolling to the row, using a small movement threshold
  to suppress chip click only when the user actually dragged.
- [x] 2.3 Prefer reusing or extracting the existing interaction pattern from
  `package/ui/src/shadcn/tabs.tsx` if that keeps the implementation local and
  understandable; otherwise keep the realm row implementation small and
  self-contained.
- [x] 2.4 Add focused component or interaction tests for wheel scrolling and
  drag-vs-click suppression if the current test setup can express them without
  brittle layout assumptions.

## 3. Navigation Semantics

- [x] 3.1 Replace the `All` chip in
  `package/app/src/realm/sections/RealmFeedTagFilter.tsx` with a final `Tags` or
  `All tags` navigation action.
- [x] 3.2 Update `package/app/src/realm/pages/RealmPage.tsx` props so the feed
  tag row can request navigation to the `Tags` tab without pretending it is a
  feed filter change.
- [x] 3.3 Update
  `package/app/src/routes/_mainLayout/realm/$realmId/index.tsx` so the full-list
  action sets `tab=tags` while preserving unrelated search state.
- [x] 3.4 Keep feed filter clearing as a separate interaction, either by
  deselecting selected chips or by showing a distinct clear action only when
  `feedTagIds` is non-empty.

## 4. Verification

- [x] 4.1 Run the relevant realm model/component tests.
- [x] 4.2 Run `bun run check:convention` if shared UI helpers or class patterns
  are changed.
- [ ] 4.3 Manually verify the realm page after `bun run dev`: wheel scroll locks
  page scroll over the row, dragging does not select chips, pure click still
  selects, the scrollbar is hidden, and `All tags` opens the `Tags` tab.

## Out of scope

- Changing how realm tags are authored, stored, or ranked by the backend.
- Building search inside the feed shortcut row.
- Reworking `RealmTagBrowser` layouts beyond ensuring it remains the complete
  tag destination.
- Introducing popularity or usage-based tag ranking before the data model
  supports it.
