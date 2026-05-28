# shelf-discussion Specification

## Purpose

Defines the shelf discussion surface, where visitors can read shelf-targeted discussion posts and authenticated users can create new root-level posts targeting the shelf.

## Requirements

### Requirement: ShelfPage mounts a discussion section

`ShelfPage` (`package/app/src/shelf/pages/ShelfPage.tsx`) SHALL render a `<ShelfDiscussionSection shelfUnitId={shelf.unitId} />` as the last top-level section on the page, after the shelf items list. The section SHALL compose:

1. A top `<ReplyComposer mode="progressive" targetUnitId={shelf.unitId} />` that creates a new post targeting the shelf.
2. A `<PostListSection targetUnitId={shelf.unitId} />` that renders root-level discussion posts targeting the shelf.
3. Each root-level discussion post links to its own `/post/:rootPostUnitId` thread page for threaded replies.

The section SHALL live under `package/app/src/shelf/sections/ShelfDiscussionSection.tsx`.

#### Scenario: Shelf page renders the discussion section
- **WHEN** a user navigates to `/shelf/:shelfId`
- **THEN** the page renders, after the shelf items section, a discussion section containing a progressive `ReplyComposer` and a `PostListSection`

#### Scenario: Empty discussion renders shared empty copy
- **WHEN** the target-post query settles with zero posts for this shelf
- **THEN** the section renders the shared post-list empty copy
- **AND** the section SHALL NOT render an empty container or blank region

### Requirement: Shelf discussion uses the shared post capabilities

The shelf discussion section SHALL NOT introduce a new post-presentation component, reply-composer variant, or shelf-only thread-rendering component. It SHALL reuse:

- `PostListSection` (from `package/app/src/post/sections/`), passing `targetUnitId = shelf.unitId`.
- `ReplyComposer` (per `post-reply-composer`).
- `PostCard` and `ReactionBar` (per `post-presentation-architecture` and `engagement-reaction-bar`) on rendered root-level discussion posts.

#### Scenario: No shelf-only post components exist
- **WHEN** a developer inspects `package/app/src/shelf/`
- **THEN** no component named `ShelfPost*`, `ShelfComment*`, or similar defines a bespoke post card or composer
- **AND** all post rendering comes from `@/post/*` or `@/engagement/*`

### Requirement: Creating a post from the shelf discussion composer targets the shelf

When a user submits the shelf discussion's top composer, the resulting post SHALL be created with `kind: "COMMENT"` (or the existing default post kind used for generic discussion) and `targetUnitId` set to the shelf's unit id. Replies inside the tree SHALL follow the normal reply semantics (replies to a root-level post are children of that post in the tree, not direct children of the shelf).

#### Scenario: Root-level comment targets the shelf
- **WHEN** a user submits the top progressive composer with body "great list"
- **THEN** the post is created with `targetUnitId: shelf.unitId`
- **AND** appears in the shelf `PostListSection` after the target-post query refreshes

#### Scenario: Reply targets its parent post, not the shelf
- **WHEN** a user clicks "Reply" on a root-level comment and submits
- **THEN** the user is taken to the root comment's `/post/:rootPostUnitId` detail thread
- AND replies created there use `parentPostUnitId` set to the focal/root comment's id
- AND they render as children of that root comment in the post thread tree

### Requirement: Shelf discussion is visible to all visitors

The shelf discussion section SHALL render for unauthenticated visitors as well. Unauthenticated visitors SHALL see the post tree read-only, with the progressive composer replaced by a sign-in prompt per the existing pattern used elsewhere. Reaction buttons (vote, shelf, share) on individual posts inside the tree SHALL still render; clicking them while unauthenticated triggers the app's standard sign-in flow.

#### Scenario: Unauthenticated visitor sees read-only discussion
- **WHEN** an unauthenticated user opens `/shelf/:shelfId`
- **THEN** the discussion section renders the target post list
- **AND** in place of the progressive composer, a sign-in prompt renders
