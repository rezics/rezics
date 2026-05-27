## Current State

The app has broad surface area: routes for home, book, search, realms, reviews, shelves, profiles, inbox, feedback, creation, and entity/tag pages. Feature folders mostly follow the layered pattern. Server/API packages already expose many primitives: Unit, Post, Shelf, Reaction, Subscription, Notification, Progress, Realm, Search, History, Attribution, and editor infrastructure.

The product gap is continuity. A user can land on pages, but the app does not yet guarantee complete flows: discover something, evaluate it, add it to a shelf, read/track progress, review/comment, join related communities, receive actionable notifications, continue later, and manage their identity/preferences.

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

### Route And Navigation Model

Navigation is grouped by user intent:

- Discover: home, search, books, games/media, realms, tags/entities.
- Library: shelves, progress, continue reading, saved items.
- Community: realms, reviews, discussions, inbox, DMs.
- Create: content creation entry points with work matching and validation.
- Me: profile, settings, notifications, drafts, moderation/status messages.

Existing demo/test routes are not production navigation entries.

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
- validate metadata and language;
- save draft;
- preview;
- publish or submit for review when policy requires;
- show post-submit next actions.

Work/release matching aligns with `introduce-unit-work-domain` but does not depend on `introduce-api-unit-store`.

### Engagement

Engagement is consistent across cards and detail pages: reaction, comment/reply, shelf/save, follow/subscribe, share, report, and DM are placed where context supports them. Safety/report entry points create moderation cases from `complete-site-governance-permissions`.

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
