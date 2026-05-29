## ADDED Requirements

### Requirement: Public app navigation is organized by user intent

The public app SHALL organize navigation into discovery, library, community, create, and personal areas, with signed-in/out visibility rules.

#### Scenario: Signed-out user sees discovery-first navigation

- **WHEN** an unauthenticated user opens the app
- **THEN** navigation SHALL expose discovery routes and authentication entry points
- **AND** personal-only routes SHALL not appear as active options

### Requirement: Production navigation excludes test routes

Routes used only for diagnostics, experiments, or test pages SHALL NOT appear in production navigation.

#### Scenario: Test route not shown

- **WHEN** a user opens the main sidebar or create menu
- **THEN** entries such as test/demo routes SHALL not be listed

### Requirement: Realm navigation follows the realm product IA

Realm detail navigation SHALL default to Feed, expose About for stable community information, and expose Moderation only to authorized moderators/staff. Queue, reports, sanctions, and audit are subviews of Moderation rather than top-level public tabs.

#### Scenario: Visitor opens a realm from navigation

- **WHEN** a visitor navigates to a realm
- **THEN** the Feed tab SHALL be the initial active tab
- **AND** moderator-only Moderation entries SHALL be hidden

### Requirement: Chapter link generators pick the most specific route

Internal callers that produce a link to a chapter SHALL select the target route based on the most specific context they hold, in this order of preference:

1. **`/book/:bookId/node/:nodeId`** — used when the caller holds a `nodeId` (TOC navigation, dashboard continue-reading via `lastReadNodeId`, book reader sidebar, chapter list rendered from the book TOC, notifications whose source event carries a `nodeId`, the "Continue reading" entry on book detail pages). This route preserves multi-link TOC disambiguation, writes `lastReadNodeId` on visit, and exposes the per-node "Mark as read" affordance.
2. **`/book/:bookId/read/:chapterId`** — used when the caller holds the chapter Unit id within a known book Unit but no `nodeId` is available (chapter-Unit-scoped notifications such as a reply on the chapter Post, editor preview returning to the reader after edits, links from a search result that matched the chapter Unit only). This route renders the chapter content with book context but SHALL NOT write `lastReadNodeId` or highlight a TOC node, and SHALL NOT expose the per-node "Mark as read" toggle.
3. **`/chapter/:contentUnitId`** — used when no book Unit context applies (cross-book references, standalone chapter Unit shares, legacy links). This route renders the chapter Unit only and SHALL NOT expose book-level affordances.

Callers SHALL NOT downgrade to a less specific route when they have the more specific context, and SHALL NOT fabricate a `nodeId` (e.g. by picking one of N multi-link TOC entries arbitrarily) just to use route #1. Multi-link disambiguation SHALL come from the source event, not the renderer.

#### Scenario: TOC sidebar link uses node route

- **GIVEN** a book reader TOC sidebar that holds each TOC entry's `nodeId`
- **WHEN** the sidebar renders a chapter entry as a link
- **THEN** the link's `href` SHALL be `/book/:bookId/node/:nodeId`
- **AND** SHALL NOT be `/book/:bookId/read/:chapterId` even when the node has a materialized `contentUnitId`

#### Scenario: Reply notification on a chapter uses chapter route

- **GIVEN** a notification whose source event is a reply on a chapter Post Unit (no `nodeId` carried)
- **WHEN** the notification card resolves its deep link
- **THEN** the link target SHALL be `/book/:bookId/read/:chapterId` (book context is known via the chapter Unit's `ownerUnitId`)
- **AND** the link SHALL NOT be `/book/:bookId/node/:nodeId` even when the chapter is currently linked from exactly one TOC node

#### Scenario: Cross-book share link uses standalone chapter route

- **GIVEN** an external share target for a chapter Unit that has been promoted to be referenced across multiple books
- **WHEN** the share producer assembles the canonical URL
- **THEN** the URL SHALL be `/chapter/:contentUnitId`
- **AND** SHALL NOT bind the share to any specific book context

### Requirement: Personal navigation surfaces dashboard and drafts

The personal navigation area SHALL include entries for the signed-in dashboard and the drafts management surface in addition to profile, settings, and inbox.

#### Scenario: Signed-in user opens personal navigation

- **WHEN** a signed-in user opens the personal navigation area
- **THEN** entries for dashboard and drafts SHALL be visible
- **AND** activating each SHALL route to `u/me/dashboard` and `u/me/drafts` respectively
