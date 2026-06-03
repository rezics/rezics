---
title: Admin navigation IA refactor + /status split
status: done
created: 2026-06-03
completed: 2026-06-03
supersededBy:
tags: [admin, navigation, ia, system-health, i18n]
---

## Why

The admin panel (`package/admin`, `localhost:35002`) navigation
(`adminNavConfig.tsx`) has accreted duplicates, mislabels, mixed-language
labels, and "create" actions masquerading as destinations. At the same time the
product needs more admin surfaces (governance/moderation, content moderation
views) that don't exist yet. We want to **lock the full navigation spine now** —
grouped by operator intent — with unbuilt areas shown as routed placeholders, so
the shape of the product is stable and deep-linkable while features land behind
it.

The concrete first symptom is `/status`: `StatusPage` stacks seven heavy panels
(`StatusPanels.tsx`) in one column — including a full Meili summary that
duplicates the existing `/meili/observability` page, and a full job-queue table.
It is unusable as one page. This plan splits it into a thin overview plus focused
sub-pages under an **Operations** section.

Outcome: one intent-grouped nav with no duplicate targets, all labels sourced
from `admin.json` i18n keys, placeholder entries routed to a shared coming-soon
stub, and `/status` decomposed into overview + per-concern sub-pages.

## Durable constraints & decisions

- **Nav is grouped by operator intent**, not by target. Final top-level spine:
  `Dashboard`, then groups `Content`, `Governance`, `Accounts & Access`,
  `Operations`, `System`. (comment on `adminNavConfig.tsx` — the grouping axis is
  a deliberate IA choice, not incidental ordering.)
- **No nav entry may point at a route another entry already owns.** Remove the
  three current duplicates: top-level `status` vs `system.status` (→ `/status`),
  `accounts.tokens` vs `system.legacy-token` (→ `/token`), `content.realms` vs
  `governance.realm-escalations` (→ `/realm`). (test) a unit test over the nav
  config asserting every `to` is unique across the flattened tree.
- **"Create" is an action, not a destination.** Drop `content.unit-create` and
  `accounts.user-create` from the nav; `/unit/create` and `/user/create` remain
  routable and are reached from their list pages. (comment)
- **All nav labels and group titles come from `i18n.t("admin:…")`.** No
  hardcoded label strings in `adminNavConfig.tsx` (today `"系統狀態"`,
  `"狀態觀測"`, `"Content"`, `"Accounts"`, `"Governance"`, `"Search / Sync"`,
  `"System"`, `"Source sites"`, `"Repair jobs"`, `"Overview"` are inline). (test)
  a convention/test that the config contains no string literals in `label`
  thunks (labels must be `() => t(...)`).
- **The two JWT pages are distinct systems and both stay**, with disambiguated
  labels: `/auth/jwt-services` = auth-service trusted JWT services (lives under
  *Accounts & Access*); `/jwt-services` = main-server JWT service registry (lives
  under *System*, owner-gated). (comment on both nav entries recording which
  service each registry belongs to, so they aren't "deduped" by mistake later.)
- **Placeholders are real routes rendering a shared stub**, not disabled items.
  Add an optional `placeholder?: true` flag to `AdminNavItem`; the nav renders a
  small "soon" affordance but the item links normally to its `to`, which resolves
  to a route rendering `PlaceholderPage`. This generalizes the existing
  `realm_management_*` / `shelf_management_*` coming-soon pattern. (type) the
  `placeholder` flag on `AdminNavItem`.
- **`/status` becomes a section, not a layout route.** `/status` (overview) and
  `/status/services|queue|cdc|history` are independent sibling file-routes;
  `status.tsx` does not become a parent layout. (comment)
- **The overview must not re-render the heavy panels.** `/status` overview shows
  the overall-state banner + service links + summary cards that *link down* to
  the sub-pages (reuse the dashboard `SummaryMetricCard` linking pattern). The
  Meili panel is **not** rebuilt on status — link to `/meili/observability`.
  (comment on the overview page.)
- **Panel components are reused, not rewritten.** `ServicesPanel`, `QueuePanel`,
  `CdcPanel`, `HistoryOutboxPanel`, `ServiceLinksPanel` already exist and are
  exported from `StatusPanels.tsx`; sub-pages compose them. `SystemStatusPanels`
  (the do-everything aggregate) stops being used by a route once the split lands.
- **`routeTree.gen.ts` is generated** by the TanStack router plugin; never
  hand-edit it. New route files under `routes/_admin/` are picked up on dev/build.

## 1. Nav config refactor

- [x] 1.1 Add `placeholder?: true` to `AdminNavItem` in
  `package/admin/src/navigation/adminNavConfig.tsx`.
- [x] 1.2 Rebuild `adminNav.items` into the intent spine: `Dashboard` (top item)
  then groups `Content`, `Governance`, `Accounts & Access`, `Operations`,
  `System`. All `label` thunks call `i18n.t("admin:…")`.
- [x] 1.3 In the new spine: remove duplicate entries (`system.status`,
  `system.legacy-token`, `governance.realm-escalations`) and the two create
  entries (`content.unit-create`, `accounts.user-create`); fix the mislabeled
  `misc.token` entry (id, label, route → it is **Settings** `/settings`).
- [x] 1.4 Place `Operations` group children: `status` (overview, `/status`),
  `status.services` (`/status/services`), `status.queue` (`/status/queue`),
  `status.cdc` (`/status/cdc`), `status.history` (`/status/history`), `meili`
  (`/meili`), `meili.observability` (`/meili/observability`), `repair`
  (`/repair`), plus the per-entity Meili debug pages
  (`unit/meili`, `book/meili`, `user/meili`).
- [x] 1.5 Add `Governance` placeholder children with `placeholder: true`:
  `governance.cases` (`/governance/cases`), `governance.audit`
  (`/governance/audit`), `governance.enforcement` (`/governance/enforcement`);
  keep `governance.overview` (`/governance`) and `governance.authority`
  (`/authority`).
- [x] 1.6 Add `Content` placeholder children with `placeholder: true`:
  `content.posts` (`/post`) and `content.reviews` (`/review`); keep existing real
  Content entries (units, books, entities, source-sites, realms, shelves, tags).
- [x] 1.7 Disambiguate the two JWT entries: `accounts.auth-jwt-services`
  (`/auth/jwt-services`) under *Accounts & Access*, `system.jwt-services`
  (`/jwt-services`, owner) under *System*, with distinct i18n labels.

## 2. Nav rendering + placeholder stub

- [x] 2.1 In `package/admin/src/navigation/AdminNav.tsx`, render a "soon"
  affordance for items with `placeholder: true` (e.g. a muted badge next to the
  label); the item still links to its `to`.
- [x] 2.2 Create `package/admin/src/core/layouts/PlaceholderPage.tsx` — a small
  component wrapping `Page` with a coming-soon title/description (i18n), mirroring
  the existing `realm_management_*` / `shelf_management_*` stub copy.
- [x] 2.3 Add placeholder route files rendering `PlaceholderPage`:
  `routes/_admin/governance/cases.tsx`, `routes/_admin/governance/audit.tsx`,
  `routes/_admin/governance/enforcement.tsx`, `routes/_admin/post/index.tsx`,
  `routes/_admin/review/index.tsx` (each via `createFileRoute("/_admin/…")`).

## 3. /status split

- [x] 3.1 Rewrite `package/admin/src/system-health/pages/StatusPage.tsx` as the
  **overview**: overall-state banner + `ServiceLinksPanel` + summary cards (reuse
  dashboard `SummaryMetricCard` pattern) that link to the sub-pages and to
  `/meili/observability`. Keep the refresh action.
- [x] 3.2 Add sub-pages under `package/admin/src/system-health/pages/`:
  `StatusServicesPage` (`ServicesPanel`), `StatusQueuePage` (`QueuePanel`),
  `StatusCdcPage` (`CdcPanel`), `StatusHistoryPage` (`HistoryOutboxPanel`). Each
  wraps `Page` and pulls from `useAdminSystemStatusQuery`.
- [x] 3.3 Add route files: `routes/_admin/status/services.tsx`,
  `routes/_admin/status/queue.tsx`, `routes/_admin/status/cdc.tsx`,
  `routes/_admin/status/history.tsx` (lazy-load the new pages).
- [x] 3.4 Stop routing to `SystemStatusPanels`; if nothing else consumes it,
  remove it from `StatusPanels.tsx` (keep the individual panel exports).

## 4. i18n keys

- [x] 4.1 Add new keys to `package/i18n/locales/*/admin.json` (all locales:
  `en`, `de`, `ja`, `ko`, `zh-hans`, `zh-hant`): group titles
  (`nav_group_content`, `nav_group_governance`, `nav_group_accounts`,
  `nav_group_operations`, `nav_group_system`); operations items
  (`nav_status_overview`, `nav_status_services`, `nav_status_queue`,
  `nav_status_cdc`, `nav_status_history`, `nav_source_sites`, `nav_repair`);
  governance/content placeholders (`nav_governance_cases`,
  `nav_governance_audit`, `nav_governance_enforcement`, `nav_posts`,
  `nav_reviews`).
- [x] 4.2 Add page-copy keys for the new pages: status sub-page titles/
  descriptions (`status_services_title/description`, `status_queue_…`,
  `status_cdc_…`, `status_history_…`, `status_overview_…`) and a generic
  placeholder (`placeholder_coming_soon_title`,
  `placeholder_coming_soon_description`).
- [x] 4.3 Clarify the two JWT label strings so they name their service
  (auth-service vs main-server) rather than both reading "JWT 服務".

## Out of scope

- Building any governance/moderation or content-moderation feature behind the new
  placeholder routes — they render the stub only. (The moderation data model is
  tracked in `plan/proposal/moderation-governance-redesign.md`.)
- Reworking the per-entity Meili debug pages (`/unit/meili`, `/book/meili`,
  `/user/meili`) beyond regrouping them under *Operations*.
- Building a `/tag` index route; the Tags entry continues to point at the existing
  low-score view for now.
- Any change to the main app (`@rezics/app`) navigation — this is admin-only.
- Translating placeholder/stub copy beyond a single coming-soon string per locale.
