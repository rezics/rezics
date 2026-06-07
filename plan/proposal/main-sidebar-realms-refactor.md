---
title: Main Sidebar Realms Refactor
status: done
created: 2026-06-07
completed: 2026-06-07
supersededBy:
tags: [app, navigation, sidebar, realms]
---

## Why

The main app sidebar currently exposes too many top-level destinations for the
intended catalog-first shell. It should become a quieter navigation surface with
one unlabelled primary group and one Realms group, while leaving existing routes
and page functionality intact.

The Realms group should make joined communities available from the sidebar and
provide an All Realms page for management, without introducing route-specific
sidebars or premature list virtualization in this pass.

## Durable constraints & decisions

- (test) Removing `Search`, `Reviews`, `Units`, `Shelves`, and `Create` from the
  sidebar must not remove or redirect their existing routes; this change only
  removes sidebar entry points.
- (test) Header search remains mounted in the main layout header.
- (test) Main sidebar navigation has exactly two visible groups for normal app
  navigation: an unlabelled primary group and a `Realms` group.
- (comment) The first sidebar group intentionally has no section title so the
  highest-frequency catalog entries read as primary chrome, not as a labelled
  category.
- (test) Sidebar item rows and collapsible section headers use a stable 40px
  height across main and editor sidebars because both render through the shared
  navigation list.
- (test) The Realms section is collapsible and renders the correct chevron state
  for expanded and collapsed states.
- (test) The Realms section lists `All Realms` first, followed by the current
  user's joined realms when available.
- (comment) Do not virtualize the Realms sidebar list in this pass; simple
  40px rows for roughly 100-200 realms are acceptable until measured rendering
  or scrolling evidence shows a problem.
- (test) All Realms management mode supports selecting multiple joined realms
  and leaving the selected realms without leaving unrelated realms.
- (test) Realm membership cache invalidation refreshes any sidebar and All
  Realms reads after a leave action, including language-aware `mine` queries.

## Tasks

## 1. Sidebar Navigation Shape

- [x] 1.1 Update `package/app/src/core/components/navigation/navigation.ts` if
  the navigation item model needs section metadata for unlabelled or collapsible
  sections.
- [x] 1.2 Refactor
  `package/app/src/core/components/navigation/MainNavigation.tsx` so normal app
  navigation emits an unlabelled primary group with `Home`, `Books`, `Games`,
  and `Media`, plus a `Realms` section.
- [x] 1.3 Remove sidebar entry points for `Search`, `Reviews`, `Units`,
  `Shelves`, and `Create` while preserving their route files and page modules.
- [x] 1.4 Keep admin/developer-only sidebar entries compatible with the new
  grouping behavior or explicitly isolate them from normal app navigation.

## 2. Shared Sidebar Rendering

- [x] 2.1 Update
  `package/app/src/core/components/navigation/NavigationList.tsx` so item rows
  use a stable 40px height.
- [x] 2.2 Update section rendering in
  `package/app/src/core/components/navigation/NavigationList.tsx` so collapsible
  section headers use a stable 40px height and render `ChevronUp` /
  `ChevronDown` based on open state.
- [x] 2.3 Ensure the first unlabelled section renders no title row while still
  preserving list semantics and active-link behavior.
- [x] 2.4 Verify editor sidebars continue to render correctly through
  `package/app/src/core/layouts/EditConsoleLayout.tsx` and the shared
  navigation list.

## 3. Realms Sidebar Data

- [x] 3.1 Add a main-sidebar Realms section component or builder under
  `package/app/src/core/components/sidebar/` or the nearest existing navigation
  home that reads joined realms with `myRealmsQuery`.
- [x] 3.2 Reuse existing realm href helpers or `unitHref` so joined realm links
  prefer slugs when present and fall back to unit IDs.
- [x] 3.3 Add loading, empty, and error states that keep the sidebar compact and
  do not shift primary navigation rows.
- [x] 3.4 Keep the Realms section as a normal scrollable list for this pass; do
  not add TanStack Virtual or another virtualization dependency.

## 4. All Realms Management Page

- [x] 4.1 Add or adapt a route/page for the current user's joined realms, using
  the existing `myRealmsQuery` API rather than adding backend endpoints.
- [x] 4.2 Render joined realms with existing realm list item/card models where
  practical, matching current Rezics app density and token usage.
- [x] 4.3 Add a management mode that enables multi-select and a batch leave
  action.
- [x] 4.4 Use the existing leave realm mutation for each selected realm and
  refresh joined realm reads after success.
- [x] 4.5 Add confirmation or an equivalent explicit destructive-action guard
  before leaving multiple realms.

## 5. Tests And Verification

- [x] 5.1 Add focused tests for the navigation builder covering the new normal
  sidebar groups and removed sidebar-only entries.
- [x] 5.2 Add focused rendering/model tests for collapsible section behavior and
  40px row/header expectations where the existing test setup supports it.
- [x] 5.3 Add tests or mutation invalidation coverage ensuring leave actions
  refresh `realmKeys.mine(...)` queries used by sidebar and All Realms.
- [x] 5.4 Run the relevant app/unit checks for the touched packages and record
  any checks that cannot run locally.

## Out of scope

- Route-specific sidebar layouts based on TanStack route metadata.
- Removing, redirecting, or otherwise changing existing routes such as
  `/search`, `/review`, `/unit`, `/shelf`, or `/create`.
- Removing header search.
- Virtualizing the Realms sidebar list.
- Reworking editor route ownership or replacing `EditConsoleLayout`.
