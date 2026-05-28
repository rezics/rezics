## Current State

The app has broad surface area: routes for home, book, search, realms, reviews, shelves, profiles, inbox, feedback, creation, and entity/tag pages. Feature folders mostly follow the layered pattern. Server/API packages already expose many primitives: Unit, Post, Shelf, Reaction, Subscription, Notification, Progress, Realm, Search, History, Attribution, and editor infrastructure.

The product gap is continuity. A user can land on pages, but the app does not yet guarantee complete flows: discover something, evaluate it, add it to a shelf, read/track progress, review/comment, join related communities, receive actionable notifications, continue later, and manage their identity/preferences.

Concrete app-side gaps confirmed by inspection of `package/app/src/`:

- No `dashboard/` feature folder, no dashboard route, no `DashboardSummary` contract.
- `engagement/components/` has ReactionBar / ShelfAction / ShareAction / FollowButton / ReplyAction, but **no `ReportAction` and no `DMAction`**. The existing `feedback/` feature is product feedback, not moderation report.
- No unified `routes/_mainLayout/create/` entry; `book/new.tsx`, `shelf/new.tsx`, `review/new` are scattered with no shared draft layer.
- No drafts management surface (no `drafts/` feature, no `u/me/drafts` route).
- `routes/_mainLayout/test.tsx`, `test02.tsx`, `test03.tsx`, `test-links.tsx` still mounted in production.
- `inbox/components/NotificationCard.tsx` exists but does not route per notification kind; reply/follow/moderation entries are visually rendered without deep navigation.
- `package/api/src/react-query/cache-coherence.ts` has scaffolding but no central map binding mutation domains to the namespaces they must invalidate.
- `book-read/` is reader-shaped but minimal (only `ChapterPage` + `BookReadChapterSection`); a real reader belongs in a separate change.
- `CompleteRegistrationPage` finishes account but no product onboarding.

## Target Design

### Product Journey

```txt
First visit
  -> discover/search
  -> detail page
  -> collect/read/review/comment
  -> join/follow/subscribe
  -> notifications/dashboard
  -> profile/settings/creation
```

Every major content type gets a clear user task: inspect, save, discuss, contribute, report, and share where applicable.

The public homepage remains a usable discovery/continuation surface, not a
marketing landing page. Signed-out users should immediately see browsable
library/community content and search entry points. Signed-in users may be routed
to, or prominently offered, the personal dashboard, but home and dashboard have
distinct jobs: home is public discovery; dashboard is private continuity.

### Route And Navigation Model

Navigation is grouped by user intent:

- Discover: home, search, books, games/media, realms, tags/entities.
- Library: shelves, progress, continue reading, saved items.
- Community: realms, reviews, discussions, inbox, DMs.
- Create: content creation entry points with work matching and validation.
- Me: profile, settings, notifications, drafts, moderation/status messages.

Existing demo/test routes are not production navigation entries.

Realm navigation must align with `complete-realm-community-governance`: realm
detail defaults to Feed, stable community information lives in About, and
moderator-only work enters through Moderation rather than a standalone Queue
tab.

### Personal Dashboard

The signed-in dashboard aggregates:

- continue reading/progress;
- shelves and recent collection actions;
- joined/muted realms and pending approvals;
- notifications and DMs;
- drafts and recently edited content;
- reviews/remarks/replies;
- safety or moderation status when relevant;
- recommendations/search shortcuts based on existing data.

This should be a composed API surface where server aggregation is useful, not a client-side scatter of unrelated requests.

### Creation Workflows

Creation flows use existing editor and Unit infrastructure. They should be guided and recoverable:

- choose content type;
- search for existing work/entity/tag/realm;
- choose or add the relevant UnitTranslation language for display metadata;
- validate metadata and language;
- save draft;
- preview;
- publish or submit for review when policy requires;
- show post-submit next actions.

Work/release matching aligns with `introduce-unit-work-domain` but does not depend on `introduce-api-unit-store`.

### Engagement

Engagement is consistent across cards and detail pages: reaction, comment/reply, shelf/save, follow/subscribe, share, report, and DM are placed where context supports them. Safety/report entry points create moderation cases from `complete-platform-authorization`.

### Quality States

All production routes define loading, empty, error, denied, not-found, unauthenticated, and responsive states. UI follows Rezics design-system constraints: token colors, app density, accessible status text, no raw links, and Traditional Chinese copy coverage.

## Alternatives Considered

- Rebuild app around a new client store: rejected because the repo already has typed `@rezics/api` and TanStack Query patterns; `introduce-api-unit-store` is explicitly out of scope.
- Make a marketing landing page first: rejected because the target is a usable app, not promotion.
- Finish each feature in isolation: rejected because maturity depends on end-to-end workflows.

## Risks

- Scope is broad. Mitigate by implementing by user journey slices with acceptance tests.
- Aggregated dashboard APIs can duplicate feature APIs. Mitigate by returning dashboard-specific summaries while deep pages keep domain APIs.
- Creation flows can become too generic. Mitigate with type-specific steps layered over shared primitives.

## Rollout Plan

1. Define route/navigation inventory and remove production exposure of test/demo routes.
2. Add dashboard contracts/API and app feature.
3. Upgrade discovery/search/detail/library journeys.
4. Upgrade creation workflows and draft/preview/publish lifecycle.
5. Integrate engagement, notification, safety, and report actions.
6. Add quality-state coverage, seed scenarios, and story/test coverage for critical flows.

## Contract Lock-in (resolved for implementation)

Depends on `complete-platform-authorization` (publish-policy states, DM/report
permission) and `complete-realm-community-governance` (realm navigation
structure); softly on `complete-game-media-library-backend` (game/media
browsing). Build after those land. Contract-first throughout — no app-local DTO
copies. See `implement_goal.md` (Phase 6). Contracts to pin:

- **`DashboardSummary` DTO + server endpoint** — new `package/contract/src/dashboard.ts`
  and `package/server/src/dashboard/` domain. Server-side aggregation of
  progress, shelves, realms, notifications, DMs, drafts, activity, and safety
  status, with per-section partial-success fields (`{ ok: T } | { error: { code, retryable } }`)
  so the UI renders available sections when one source fails. Aggregation happens
  on the server reusing existing domain services; the client must **not** scatter
  and re-aggregate. App folder is `package/app/src/dashboard/` following the
  feature-standard layout, mounted at `routes/_mainLayout/u/me/dashboard.tsx`.
- **Direct messaging contract** — already lives in `package/contract/src/notify/dm.ts`
  with server in `package/notify/src/dm/` (notify owns realtime). This change
  extends it with read-receipts, typing-indicator, and block/unblock-peer fields,
  all permission-gated by Phase 1's policy engine. Group DM is out of scope.
- **`DraftMetadata` contract + drafts feature** — new `package/contract/src/draft.ts`
  for cross-type draft listing (review/post/remark/wiki/shelf-description). Server
  reuses existing per-type draft storage; the contract provides the unified
  listing/recovery surface consumed by dashboard and `u/me/drafts`.
- **Search release grouping** — already in `package/contract/src/search/scope.ts`
  (`workUnitId` + scope mode). App work this change adds: explicit filter-chip UI
  on the search route, type/realm/work-grouping filter persistence in URL query.
- **Policy-aware creation forms** — a shared form helper that reads `PolicyDecision`
  from mutation responses and renders publish-denial states
  (`MISSING_CAPABILITY`/`ENFORCEMENT_ACTIVE`/`BLOCKED_ACCOUNT`/`RATE_LIMITED`)
  inline, not as toast errors. Applied to review, post, remark, shelf, realm
  creation entries.
- **Cache-invalidation key map** — `package/api/src/react-query/cache-coherence.ts`
  exists as a framework; this change adds a central map declaring which
  namespaces each mutation domain (collect/follow/reaction/progress/draft/dm/
  realm-membership/report) must invalidate across detail + dashboard + profile +
  search + realm-feed.
- **Engagement action closure** — add `ReportAction` and `DMAction` to
  `package/app/src/engagement/components/`. `ReportAction` **must not** reuse
  `package/app/src/feedback/` (that is product feedback, not moderation report);
  it targets governance/moderation report endpoints. `DMAction` consults policy
  to decide visibility/disabled state.
- **Notification deep-link routing** — `NotificationCard` routes per `kindKey`
  (reply → thread + anchor, follow → profile, moderation outcome →
  authorization-appropriate detail). Contract: extend
  `package/contract/src/notification/` items with `target: { route, params, anchor? }`.
- **Cleanup** — remove `test`/`test02`/`test03`/`test-links` route files from
  `routes/_mainLayout/` and any references in `core/components/create-menu/` and
  the sidebar/navigation config.

## Out of scope (open as separate changes)

- **`introduce-app-onboarding-flow`** — first-login product onboarding
  (language → tag/realm interest → first shelf). Current `CompleteRegistrationPage`
  only completes the account, not the product introduction.
- **`introduce-app-reader-experience`** — `package/app/src/book-read/` currently
  has only `ChapterPage` + `BookReadChapterSection`. Bookmarks, highlights,
  notes, font/theme preferences, TOC, and chapter navigation belong in a
  dedicated reader change so this one does not balloon.
- **`introduce-content-sharing`** (optional) — OG image generation, canonical
  share URLs, external embed widgets. Not on the core journey; defer unless a
  Phase 6 surface demands it.
