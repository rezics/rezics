## ADDED Requirements

### Requirement: Production routes define complete UI states

Each production route SHALL define loading, empty, error, denied, not-found, unauthenticated, and success states appropriate to its data and permissions. Reading routes (`/book/:bookId/node/:nodeId`, `/book/:bookId/read/:chapterId`) SHALL additionally define **deleted-node placeholder** (rendered when `node.isDeleted = true` or the referenced chapter Unit `status = DELETED`) and **empty-node placeholder** (rendered when the node exists, is not deleted, and has `contentUnitId = null`) states. Both placeholders SHALL meet the same token, a11y, focus, and i18n requirements as other production states; neither SHALL be implemented as a generic error or not-found view.

#### Scenario: Search has no results

- **WHEN** search returns no results
- **THEN** the page SHALL render a helpful empty state with next actions instead of a blank area

#### Scenario: Deleted-node placeholder meets quality bar

- **WHEN** a user opens `/book/:bookId/node/:nodeId` for a soft-deleted node
- **THEN** the page SHALL render a deleted-node placeholder that names the node, explains the deletion state, and (for users with edit permission) exposes a restore CTA
- **AND** the placeholder SHALL use Rezics tokens, app density, accessible status text, Traditional Chinese copy, and SHALL NOT communicate state by color alone

#### Scenario: Empty-node placeholder meets quality bar

- **WHEN** a user opens `/book/:bookId/node/:nodeId` for a non-deleted node whose `contentUnitId` is null
- **THEN** the page SHALL render an empty-node placeholder that names the node, explains that no chapter content exists yet, and (for users with edit permission) exposes a "Create chapter" CTA
- **AND** the placeholder SHALL use Rezics tokens, app density, accessible status text, Traditional Chinese copy, and SHALL NOT communicate state by color alone

### Requirement: Public app UI follows Rezics design rules

Public app UI SHALL use Rezics design tokens, app density, shared UI primitives, `SafeLink`, accessible status text, and Traditional Chinese localization coverage.

#### Scenario: Error state is accessible

- **WHEN** a mutation fails
- **THEN** the UI SHALL show text describing the failure and recovery action
- **AND** it SHALL not communicate state by color alone

### Requirement: Public app meets WCAG 2.1 AA expectations

Public app UI SHALL be operable by keyboard alone for all interactive components, expose accessible names and roles for screen readers, maintain visible focus indicators, and respect the user's reduced-motion preference for non-essential animation.

#### Scenario: Keyboard user activates engagement action

- **WHEN** a keyboard user tabs to a reaction, follow, shelf, report, or DM action and presses Enter or Space
- **THEN** the action SHALL trigger
- **AND** focus SHALL remain on or move to a meaningful next element

#### Scenario: Reduced motion is honored

- **WHEN** the user has reduced-motion enabled at the OS level
- **THEN** non-essential transitions and parallax SHALL be disabled or shortened

### Requirement: Public app is responsive across primary breakpoints

Dashboard, search, detail, shelf, profile, settings, creation, and inbox routes SHALL define responsive layouts at primary breakpoints (compact, regular, wide) without horizontal page scroll on supported viewports.

#### Scenario: User opens dashboard on a compact viewport

- **WHEN** a signed-in user opens the dashboard on a compact viewport
- **THEN** sections SHALL stack vertically without horizontal page scroll
- **AND** primary actions SHALL remain reachable without hidden overflow menus

### Requirement: User-triggered mutations support offline retry

When the user explicitly triggers a mutation (collect, follow, react, send DM) and the network is unavailable or the request fails transiently, the UI SHALL surface a retry affordance that re-runs the mutation without forcing the user to re-enter input.

#### Scenario: User sends a DM while offline

- **WHEN** a user sends a DM and the request fails because the network is offline
- **THEN** the UI SHALL show a retry affordance on the failed message
- **AND** activating retry SHALL re-send the same payload without re-typing
