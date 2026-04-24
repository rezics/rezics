## Requirements

### Requirement: Post-kind features share a fixed presentation layout

The `post/`, `remark/`, `review/`, and `excerpt/` feature folders under `package/app/src/` SHALL conform to a single presentation layout. Each feature SHALL organise its presentation into the following subfolders where applicable:

- `components/item/` — atomic card renderers for list and carousel contexts
- `components/list/` — list- and carousel-shaped containers that accept an array of items
- `components/detail/` — detail-page focal renderers (applies to `remark/`, `review/`, `excerpt/`; not applicable to generic `post/`)
- `components/parts/` — composable sub-atoms such as author header, body block, reaction footer (applies to `post/`)
- `sections/` — business sections that own data fetching, mutations, and interaction state
- `forms/` — user-input composers (inline form, drawer, edit dialog)
- `hooks/` — React logic helpers (side-effectful logic extracted from sections for reuse and testing)
- `pages/` — thin route-level entries
- `index.ts` — the one public export

Components under `components/` SHALL remain free of side effects (no data fetching, no mutations, no global-store reads that trigger re-renders on unrelated state). Business orchestration SHALL live in `sections/`.

#### Scenario: A new post kind is added

- **WHEN** a developer introduces a new `PostKind` and its supporting feature folder under `package/app/src/`
- **THEN** the feature folder SHALL provide `components/item/`, `components/list/`, `components/detail/`, `sections/`, `forms/` (as needed), `pages/`, and `index.ts`
- **AND** no card or detail component SHALL call `useQuery`, `useMutation`, or any other side-effectful hook

#### Scenario: A loose component is found outside the allowed subfolders

- **WHEN** a review, remark, or excerpt feature contains a presentation file directly under `components/` without sitting in `item/`, `list/`, `detail/`, or `parts/`
- **THEN** the file SHALL be relocated into the correct subfolder or refactored to compose existing subfolder components

### Requirement: Post body is rendered as Markdown on every surface

Every card, reply-node, and detail renderer for a `PostDTO` SHALL render `post.body` through a single shared atom `PostBodyMarkdown` that composes `MarkdownContent` from `@rezics/ui` with an optional `Collapsible` wrapper. No presentation path SHALL render `post.body` as plaintext `Typography` or a clamped text node.

Preview surfaces (item cards in list contexts) SHALL use `Collapsible` with `maxLines={4}` and i18n-keyed expand/collapse labels. Detail surfaces SHALL render the body without the `Collapsible` wrapper.

#### Scenario: A review card renders the body

- **WHEN** a `ReviewCard` in a list or carousel renders a review
- **THEN** the card SHALL render `review.body` via `PostBodyMarkdown` with `Collapsible` `maxLines={4}`

#### Scenario: A remark detail page renders the body

- **WHEN** a `RemarkDetail` renders the focal remark on `/remark/:remarkId`
- **THEN** the detail SHALL render `remark.body` via `PostBodyMarkdown` without a `Collapsible` wrapper, displaying the full Markdown-rendered content

#### Scenario: An excerpt card in a carousel renders the body

- **WHEN** an `ExcerptCard` in `HorizontalExcerptCarousel` renders an excerpt
- **THEN** the card SHALL render `excerpt.body` (or equivalent content field mapped through the excerpt adapter) via `PostBodyMarkdown` with `Collapsible` `maxLines={4}`

### Requirement: Presentation components do not own edit affordances

`PostCard`, `PostReply`, `RemarkCard`, `ReviewCard`, `ExcerptCard`, and every other presentation component in `components/item/`, `components/list/`, `components/parts/`, and `components/detail/` SHALL NOT call `useCanEdit`, render an edit icon or menu, or import any `*EditDialog`. These components accept a post prop and render it, without authorization-dependent branches.

The edit affordance SHALL live on the detail section for the focal post (`<Kind>DetailSection.tsx`) or on a dedicated edit route, not on the card that happens to be inside it.

#### Scenario: An unauthenticated user views a remark card

- **WHEN** an unauthenticated user renders a `RemarkCard` in any list surface
- **THEN** the card SHALL render identically to how it renders for the post's owner
- **AND** no edit button SHALL appear on the card

#### Scenario: The post owner views their own remark on a detail page

- **WHEN** the post's author opens `/remark/:remarkId`
- **THEN** the edit affordance SHALL appear on the `RemarkDetailSection` surface (for example in a header action area)
- **AND** activating the edit affordance SHALL navigate to `/remark/:remarkId/edit`
- **AND** the `RemarkDetail` component itself SHALL remain free of `useCanEdit` logic

#### Scenario: A reply in a thread is editable by its owner

- **WHEN** the author of a reply views their reply inside a `PostTreeSection`
- **THEN** the edit affordance SHALL appear on a per-row action region owned by the section (for example a hover menu on the reply row), not on the `PostReply` presentation component

### Requirement: Post tree rendering uses depth caps and section-owned collapse

The post tree orchestrator `PostTreeSection` SHALL fetch the thread with `mode: "threaded"` and `maxDepth: 5`. Frontend indentation SHALL cap at a configurable `VISUAL_MAX_DEPTH` (default 4): `PostReply` receives `indentLevel = Math.min(post.depth, VISUAL_MAX_DEPTH)` and uses that value for its horizontal padding.

Collapse state for branches SHALL be owned by `PostTreeSection` (or an extracted `usePostTreeCollapse` hook). `PostReply` SHALL receive `isCollapsed` and `onToggleCollapse` as props and render the expand/collapse control accordingly. Replies at `depth >= 2` SHALL be collapsed by default on first render.

When a reply at the maximum loaded depth has further replies (`directReplyCount > 0` but children were truncated by the server `maxDepth`), a "continue thread" affordance SHALL appear on that reply. Activating it SHALL anchor a fresh `PostTreeSection` query on that reply as `rootPostUnitId`.

#### Scenario: A thread with 3 levels of replies renders with indentation

- **WHEN** `PostTreeSection` loads a thread whose deepest reply has `depth: 3`
- **THEN** replies at `depth 0, 1, 2, 3` SHALL render with `indentLevel 0, 1, 2, 3` respectively
- **AND** replies at `depth >= 2` SHALL be collapsed by default

#### Scenario: A thread with replies beyond server maxDepth exposes a continue affordance

- **WHEN** the server returns posts truncated at `depth: 5` and one of those posts has `directReplyCount > 0`
- **THEN** that post SHALL render with a "continue thread" affordance
- **AND** activating the affordance SHALL navigate to a view where that post is the new root

#### Scenario: Indentation is visually capped at VISUAL_MAX_DEPTH

- **WHEN** `VISUAL_MAX_DEPTH = 4` and a reply has `depth: 5`
- **THEN** `PostReply` SHALL compute `indentLevel = 4` for that reply
- **AND** the rendered indentation SHALL not exceed the indent used for `depth: 4` replies

#### Scenario: PostReply does not own collapse state

- **WHEN** a developer inspects the `PostReply` component source
- **THEN** `PostReply` SHALL NOT call `useState` for collapse state nor fetch any data
- **AND** all collapse state SHALL be passed in as props from the owning section

### Requirement: Post list rendering is section-owned and uses PostCard atoms

Target-anchored lists of posts (for example the thread list on a book Discussion tab, the remarks-by-book page, the reviews-by-book page) SHALL be rendered by a `sections/`-layer orchestrator that fetches the relevant posts and composes `<PostCard>` or a kind-specific card atom per item. `components/list/` files, when present, SHALL be pure layout shells (carousel shells, pagination shells) that accept an array of items and render cards; they SHALL NOT fetch data.

#### Scenario: The Discussion tab lists top-level posts

- **WHEN** a user opens the Discussion tab on a work detail page
- **THEN** the tab SHALL render a `<PostListSection targetUnitId={unitId} />` that fetches top-level posts for that target and maps each to a `<PostCard>`

#### Scenario: The remarks-by-book page lists remarks

- **WHEN** a user navigates to `/remark/book/:bookId`
- **THEN** the page SHALL render a `RemarkListSection` (or equivalent kind-specific section) that fetches remarks for the book and maps each to a `<RemarkCard>`

#### Scenario: A carousel shell does not fetch

- **WHEN** a developer inspects `HorizontalReviewCarousel` or `HorizontalExcerptCarousel`
- **THEN** the component SHALL accept an array of posts as a prop
- **AND** it SHALL NOT call `useQuery` or any data-fetching hook

### Requirement: Detail views are not cards

The detail view for each post kind (`RemarkDetail`, `ReviewDetail`, `ExcerptDetail`) SHALL render focal content without a `Card` or `Paper` container, without body clamping, and without a click-through navigation target. Detail views SHALL compose the shared parts (`PostAuthorHeader`, `PostBodyMarkdown`) plus a `<ReactionBar>` (per `engagement-reaction-bar`) with the content's detail-surface action policy, plus any kind-specific metadata (book context, score/rating, excerpt source citation). Detail views SHALL NOT compose `PostReactionFooter`, `MiniActionBar`, or `ReactionStatistics`; those components are removed by the `unified-engagement-interaction` change.

Detail sections (`RemarkDetailSection`, `ReviewDetailSection`, `ExcerptDetailSection`) SHALL compose the focal detail view with a top-level `<ReplyComposer mode="progressive">` (per `post-reply-composer`) immediately below the focal, followed by a `PostTreeSection` for the reply tree, keyed on `rootPostUnitId = post.unitId`.

#### Scenario: A remark detail page composes focal, composer, and tree

- **WHEN** a user navigates to `/remark/:remarkId`
- **THEN** the page SHALL render `<RemarkDetailSection remarkId={remarkId} />`
- **AND** the section SHALL compose `<RemarkDetail post={root} />` followed by `<ReplyComposer mode="progressive" targetUnitId={root.unitId} />` followed by `<PostTreeSection rootPostUnitId={root.unitId} maxDepth={5} />`

#### Scenario: A review detail includes book context and a ReactionBar

- **WHEN** `ReviewDetail` renders a review with an `extra.book` payload
- **THEN** the detail SHALL render the book title and a link to the book detail page alongside the focal review content
- **AND** the detail SHALL NOT use a `Card` or `CardActionArea` container
- **AND** the detail SHALL render a `<ReactionBar size="lg" actions={reviewDetailActions} />` in the focal region (not a `ReactionStatistics` block)

#### Scenario: An excerpt detail cites its source

- **WHEN** `ExcerptDetail` renders an excerpt with an `ExcerptSource` in `extra.source`
- **THEN** the detail SHALL render the full source citation including any external URL via `SafeLink` or internal unit link via `<Link to="/unit/$unitId">`
- **AND** the detail SHALL render a `<ReactionBar>` for reactions, not a `ReactionStatistics` block

#### Scenario: No removed footer components are composed

- **WHEN** a developer inspects any detail view or any `parts/` sub-atom composed into it
- **THEN** no import of `PostReactionFooter`, `MiniActionBar`, or `ReactionStatistics` SHALL exist
- **AND** `rg "PostReactionFooter|MiniActionBar|ReactionStatistics"` under `package/app/src/post/`, `review/`, `remark/`, and `excerpt/` SHALL return zero matches

### Requirement: The discussion/ feature folder is removed

The folder `package/app/src/discussion/` SHALL be removed. Its contents (generic post presentation and threading) SHALL live under `package/app/src/post/`. All call sites that previously imported from `@/discussion/*` SHALL be updated to import from `@/post/*` or from a more specific kind-feature module when appropriate.

#### Scenario: No references to the discussion folder remain

- **WHEN** the change is complete
- **THEN** no file under `package/app/src/` SHALL contain an import specifier starting with `@/discussion/` or a relative path resolving to the deleted `discussion/` folder
- **AND** no file SHALL exist at `package/app/src/discussion/`

### Requirement: Empty placeholder files are deleted

The empty file `package/app/src/review/components/RankingView.tsx` (0 bytes, never implemented) SHALL be deleted as part of this change. New zero-byte placeholder files SHALL NOT be introduced; feature folders SHALL NOT be created ahead of their populating code.

#### Scenario: RankingView.tsx is removed

- **WHEN** the change is complete
- **THEN** the file `package/app/src/review/components/RankingView.tsx` SHALL no longer exist
- **AND** no reference to `RankingView` SHALL exist in the codebase
