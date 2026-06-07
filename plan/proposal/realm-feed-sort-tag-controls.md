---
title: Realm Feed Sort And Tag Controls
status: done
created: 2026-06-07
completed: 2026-06-07
supersededBy:
tags: [realm, feed, tag, post, ui]
---

## Why

Realm feed sorting currently renders as a horizontal pill switcher above the tag
filter, which gives sorting more visual weight than tag context and repeats the
same pill pattern inside post comment threads. Tags are also inconsistent across
the realm tags tab and feed tab: the tags tab is display-only, while the feed tab
has a wrapping multi-select chip list that can expand into multiple rows.

The intended outcome is a quieter, form-like sorting control and a clearer tag
selection path. The tags tab becomes the browsing entry point: choosing a tag
enters the feed with that single tag selected. Inside the feed, tags remain a
filter surface, but render as a one-line carousel with selected tags first and an
`All` clear action at the end.

## Durable constraints & decisions

- `(test)` Selecting a tag from the realm tags tab navigates to the feed tab with
  exactly that tag in the `tags` query, replacing any previous tag selection.
- `(test)` Feed tag filtering remains multi-select after entering the feed:
  clicking an unselected tag appends it, clicking a selected tag removes it.
- `(test)` The feed tag carousel renders selected tags before unselected tags,
  and the `All` action clears the `tags` query.
- `(comment)` `All` stays at the end of the feed tag carousel so selected tags
  remain the fastest cancellation path at the beginning of the row.
- `(type)` Realm feed sort values remain the existing
  `"best" | "hot" | "new" | "top" | "rising"` union; comment sort values remain
  the existing `CommentSortMode` union from `@rezics/contract`.
- `(test)` Realm feed sorting and post comment sorting render `Sort by` as the
  select dropdown label, not as an external form label or pill button group.

## Tasks

## 1. Sort Controls

- [x] 1.1 Replace `RealmFeedSortSwitcher` in
  `package/app/src/realm/sections/RealmFeedSortSwitcher.tsx` with a shadcn
  `Select` control, preserving the existing `RealmFeedSort` union, labels, and
  `onChange` contract.
- [x] 1.2 Move `RealmFeedSortSwitcher` below `RealmFeedTagFilter` in
  `package/app/src/realm/pages/RealmPage.tsx`, keeping it in its own full-width
  row with dropdown label text `Sort by`.
- [x] 1.3 Replace the comment sort pill group in
  `package/app/src/comment/sections/CommentThreadSection.tsx` with the same
  labeled select pattern, preserving `CommentSortMode` query behavior.

## 2. Feed Tag Carousel

- [x] 2.1 Update `RealmFeedTagFilter` in
  `package/app/src/realm/sections/RealmFeedTagFilter.tsx` so tags render in a
  single horizontal carousel row instead of wrapping.
- [x] 2.2 Reorder the feed tag options so selected tags appear first while
  preserving existing tree collection order inside the selected and unselected
  groups.
- [x] 2.3 Add an `All` action at the end of the carousel that clears all selected
  feed tags.
- [x] 2.4 Cover multi-select toggling, selected-first ordering, and `All`
  clearing in focused tests or stories for `RealmFeedTagFilter`.

## 3. Tags Tab Entry Behavior

- [x] 3.1 Extend `RealmTagBrowser` in
  `package/app/src/realm/components/RealmTagBrowser.tsx` with a callback for tag
  selection, and render tag entries as selectable controls instead of inert
  spans.
- [x] 3.2 Wire `RealmPage` and
  `package/app/src/routes/_mainLayout/realm/$realmId/index.tsx` so selecting a
  tag from the tags tab navigates to `tab=feed` with that single tag in the
  `tags` query.
- [x] 3.3 Add focused coverage for tags-tab single-selection navigation, either
  at the route/page boundary or with component-level callback assertions.

## Out of scope

- No backend or contract changes.
- No changes to feed ranking semantics or comment discovery semantics.
- No redesign of realm tab navigation, moderation controls, or realm tag-tree
  management.
- No browser automation unless explicitly requested; local verification can use
  component tests, existing Storybook surfaces, and the provided dev URLs.
