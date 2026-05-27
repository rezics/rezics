## Why

`package/app` already has routes and features for books, shelves, reviews, realms, profiles, search, inbox, settings, and creation, but the public product still reads like separate surfaces rather than a complete user journey. Mature references such as BookWyrm, BookLore/Kavita, Forem, Ghost, and Discourse show that the gap is workflow depth: discovery, library management, reading/progress, creation, social feedback, notifications, and profile continuity must connect.

## What Changes

- Define the complete public-app experience from first visit through registration, discovery, detail pages, shelves/library, reading/progress, reviews/remarks, realm participation, notifications, settings, and profile management.
- Turn home/search/content detail pages into coherent entry points that guide users to books, media, games, shelves, realms, reviews, and discussions without duplicating DTOs or bypassing `@rezics/api`.
- Add a personal dashboard that aggregates continue reading, shelves, joined realms, recent reactions, notifications, drafts, created content, and moderation/account status when relevant.
- Finish creation workflows for books, shelves, reviews, remarks, posts, realms, tags, entities, and work/release-aware content matching while reusing existing editor, Unit, attribution, tag, and work-domain infrastructure.
- Deepen engagement loops: reactions, comments/replies, follows/subscriptions, DMs, notifications, sharing, report entry points, and realm/community context.
- Keep app-side staff/realm moderation entry points contextual, but leave operational `package/admin` panels to `complete-admin-operations-panel`.
- Do not depend on `introduce-api-unit-store`; use existing typed API clients, query keys, contracts, and feature-layer conventions.

## Capabilities

### New Capabilities

- `app-product-navigation`: Complete product navigation, route hierarchy, empty/denied/not-found states, and signed-in/out affordances.
- `app-personal-dashboard`: User home/dashboard for reading, shelves, realms, notifications, drafts, and recent activity.
- `app-library-workflows`: Library, shelf, reading/progress, release/work browsing, and collection workflows.
- `app-creation-workflows`: Guided creation/edit flows for public content and metadata contributions.
- `app-community-engagement`: Comments, replies, reactions, follows, DMs, notifications, reports, and realm context across app pages.
- `app-quality-states`: Accessibility, localization, loading/error/empty/offline-ish retry states, and responsive behavior requirements.

### Modified Capabilities

- `book-library-homepage`: Home page becomes a product entry point for discovery and personal continuation.
- `app-search-feature`: Search supports task-oriented discovery, filters, grouped release results, and cross-type navigation.
- `entity-detail-page`: Entity pages participate in discovery, attribution, follow, and contribution flows.
- `profile-overview`: Profiles become complete public identity and activity surfaces.
- `settings-layout`: Settings become the user control center for account, profile, preferences, security, notifications, and privacy.
- `notification-feed`: Notifications support actionability and community safety outcomes.
- `direct-messaging`: Messaging integrates with profile and notification workflows.
- `shelf-collection`: Shelves support user library and work/release-aware collection behavior.

## Impact

- Affected packages: `package/app`, `package/api`, `package/contract`, `package/ui`, `package/server`, `package/search`, and seed/story fixtures.
- UI impact: public app pages use Rezics app density, design tokens, shared states, Traditional Chinese localization coverage, and feature layering from `package/app/docs/feature standard.md`.
- API impact: add or refine typed client hooks for dashboard aggregation, creation sessions, user activity, collection actions, notification actions, and cross-type search facets.
- Migration/backward compatibility: existing routes remain valid where possible; deprecated test/demo routes SHALL be removed or moved out of the production navigation in a development-stage cutover.
