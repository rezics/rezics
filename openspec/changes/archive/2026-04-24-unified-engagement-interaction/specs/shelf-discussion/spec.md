## ADDED Requirements

### Requirement: ShelfPage mounts a discussion section

`ShelfPage` (`package/app/src/shelf/pages/ShelfPage.tsx`) SHALL render a `<ShelfDiscussionSection shelfUnitId={shelf.unitId} />` as the last top-level section on the page, after the shelf items list. The section SHALL compose:

1. A top `<ReplyComposer mode="progressive" targetUnitId={shelf.unitId} />` that creates a new post targeting the shelf.
2. A `<PostTreeSection rootPostUnitId={shelf.unitId} mode="threaded" maxDepth={5} />` that renders the tree of posts whose `targetUnitId` matches the shelf.
3. An `EmptyState` (per the `list-empty-state` capability) when the tree query is settled with zero posts, shown in place of an empty rendered region.

The section SHALL live under `package/app/src/shelf/sections/ShelfDiscussionSection.tsx`.

#### Scenario: Shelf page renders the discussion section
- **WHEN** a user navigates to `/shelf/:shelfId`
- **THEN** the page renders, after the shelf items section, a discussion section containing a progressive `ReplyComposer` and a `PostTreeSection`

#### Scenario: Empty discussion renders EmptyState
- **WHEN** the post tree query settles with zero posts for this shelf
- **THEN** the section renders `<EmptyState title={t("shelf.discussion.empty.title")} …/>`
- **AND** the section SHALL NOT render an empty `<Stack>` or blank region

### Requirement: Shelf discussion uses the shared post capabilities

The shelf discussion section SHALL NOT introduce a new post-presentation component, reply-composer variant, or thread-rendering component. It SHALL reuse:

- `PostTreeSection` (from `package/app/src/post/sections/`), passing `rootPostUnitId = shelf.unitId`.
- `ReplyComposer` (per `post-reply-composer`).
- `ReactionBar` (per `engagement-reaction-bar`) on every rendered post row, with the thread-row action policy.
- `<ThreadingRail>` and the collapse toggle UI (per `post-thread-ui`).

#### Scenario: No shelf-only post components exist
- **WHEN** a developer inspects `package/app/src/shelf/`
- **THEN** no component named `ShelfPost*`, `ShelfComment*`, or similar defines a bespoke post card or composer
- **AND** all post rendering comes from `@/post/*` or `@/engagement/*`

### Requirement: Creating a post from the shelf discussion composer targets the shelf

When a user submits the shelf discussion's top composer, the resulting post SHALL be created with `kind: "COMMENT"` (or the existing default post kind used for generic discussion) and `targetUnitId` set to the shelf's unit id. Replies inside the tree SHALL follow the normal reply semantics (replies to a root-level post are children of that post in the tree, not direct children of the shelf).

#### Scenario: Root-level comment targets the shelf
- **WHEN** a user submits the top progressive composer with body "great list"
- **THEN** the post is created with `targetUnitId: shelf.unitId`
- **AND** appears at the root of the `PostTreeSection` on refresh

#### Scenario: Reply targets its parent post, not the shelf
- **WHEN** a user clicks "Reply" on a root-level comment and submits
- **THEN** the new post's `parentId` is the root comment's id
- **AND** `targetUnitId` is the shelf's unit id (inherited from the tree root)
- **AND** it renders as a child of the root comment in the tree

### Requirement: Shelf discussion is visible to all visitors

The shelf discussion section SHALL render for unauthenticated visitors as well. Unauthenticated visitors SHALL see the post tree read-only, with the progressive composer replaced by a sign-in prompt per the existing pattern used elsewhere. Reaction buttons (vote, shelf, share) on individual posts inside the tree SHALL still render; clicking them while unauthenticated triggers the app's standard sign-in flow.

#### Scenario: Unauthenticated visitor sees read-only discussion
- **WHEN** an unauthenticated user opens `/shelf/:shelfId`
- **THEN** the discussion section renders the post tree
- **AND** in place of the progressive composer, a sign-in prompt renders
