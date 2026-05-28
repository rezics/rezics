# post-thread-ui Specification

## Purpose

Defines the threaded reply tree presentation for post detail surfaces, including threading rails, collapse controls, depth capping, and continue-thread subtree rendering.

## Requirements

### Requirement: Threading rail connects parent to children

Each reply row at `indentLevel > 0` SHALL render a vertical threading rail in its left indent gutter that visually connects the row to its parent. The rail SHALL be implemented as a shared primitive `<ThreadingRail>` that paints a thin vertical segment plus an L-shaped bend into the row's avatar, not as a CSS left-border on the row itself. Rationale: the rail must accept pointer events for the collapse hit-box described below, which a CSS border cannot provide.

#### Scenario: Depth 1 reply renders a threading rail to its parent
- **WHEN** `PostReply` renders at `indentLevel: 1`
- **THEN** a `<ThreadingRail>` is visible in the left indent gutter connecting the reply to the parent row above

#### Scenario: Depth 0 root reply renders no rail
- **WHEN** a reply renders at `indentLevel: 0` (a thread root)
- **THEN** no threading rail renders

#### Scenario: Threading rail is not a CSS border
- **WHEN** a developer inspects the rendered DOM for a reply row
- **THEN** the rail is a separate element (e.g. `<span class="threading-rail" />`) with `position: absolute` or equivalent inside the indent gutter
- **AND** the row's own container does not rely on a `border-left` for the vertical line

### Requirement: Collapse toggle on every row with children

Every reply row whose `directReplyCount > 0` SHALL render a `[−]` / `[+]` toggle control at the left edge of its row (inside or adjacent to the avatar area). When the row's subtree is expanded the toggle shows `[−]`; when collapsed it shows `[+]`. Clicking the toggle SHALL invoke `onToggleCollapse` (provided by `PostTreeSection` per the existing `post-presentation-architecture` spec).

#### Scenario: Expanded row shows [−]
- **WHEN** a reply has children and is not collapsed
- **THEN** the toggle renders the collapse glyph `[−]`

#### Scenario: Collapsed row shows [+]
- **WHEN** a reply has children and is collapsed
- **THEN** the toggle renders the expand glyph `[+]`
- **AND** the reply's children are not rendered in the tree

#### Scenario: Row without children has no toggle
- **WHEN** a reply has `directReplyCount === 0`
- **THEN** no toggle control renders on that row

### Requirement: Threading rail is clickable to toggle collapse

The `<ThreadingRail>` primitive SHALL be clickable in addition to the `[−]` / `[+]` toggle. Clicking anywhere on the rail SHALL invoke the same `onToggleCollapse` as the toggle. The rail's visible stroke SHALL be thin (≈ 2 px) but its hover / click hit-box SHALL extend to approximately 12 px wide, centred on the stroke, so the affordance is comfortable without visually widening the rail.

Hovering the rail (within the widened hit-box) SHALL highlight both the rail's stroke and the target toggle icon so the user understands they are the same control.

#### Scenario: Clicking the rail collapses the subtree
- **WHEN** a user clicks anywhere on a `<ThreadingRail>` attached to an expanded parent row
- **THEN** `onToggleCollapse` fires for that row
- **AND** the subtree collapses (the toggle switches to `[+]` and children unmount)

#### Scenario: Hovering the rail hit-box highlights both rail and toggle
- **WHEN** the user's pointer enters the 12 px hit-box around the rail
- **THEN** the rail stroke and the associated `[−]` / `[+]` toggle SHALL render a hover-state highlight simultaneously

#### Scenario: Visual stroke is narrow
- **WHEN** a developer inspects the rendered rail
- **THEN** the painted stroke is approximately 2 px wide (not 12 px)
- **AND** only the hit-box is widened

### Requirement: Collapse state is owned by PostTreeSection

`PostTreeSection` (or an extracted `usePostTreeCollapse(rootPostUnitId)` hook) SHALL own the collapse state for the entire tree. `PostReply` and `<ThreadingRail>` SHALL receive `isCollapsed` and `onToggleCollapse` via props. Neither component SHALL use local `useState` for collapse status or read from a global store. The default-collapse rule (replies at `depth >= 2` start collapsed on first render) is inherited from `post-presentation-architecture` and is not duplicated here.

#### Scenario: PostReply has no local collapse state
- **WHEN** a developer inspects `PostReply.tsx`
- **THEN** the component SHALL NOT call `useState` for collapse / expansion
- **AND** `isCollapsed` and `onToggleCollapse` SHALL be props

#### Scenario: ThreadingRail has no local state
- **WHEN** a developer inspects `<ThreadingRail>`
- **THEN** it receives all data via props and dispatches via `onToggleCollapse`

### Requirement: Indentation cap and rail depth

The visual indentation cap `VISUAL_MAX_DEPTH = 4` from `post-presentation-architecture` SHALL continue to apply. Threading rails render at each rendered indent level up to the cap. A reply at depth 5 SHALL render with `indentLevel = 4`, the same indentation as a depth-4 reply, and its rail connects to the same parent-column anchor as depth-4 replies do. The rail SHALL NOT introduce any additional visual depth beyond the cap.

#### Scenario: Deep replies collapse to the cap
- **WHEN** `PostReply` renders a reply at `post.depth: 5` and `VISUAL_MAX_DEPTH: 4`
- **THEN** the row uses `indentLevel: 4` and its rail aligns with other depth-4 rows
- **AND** no fifth vertical rail column appears

### Requirement: Continue thread pages render server-side subtrees

When a thread reaches its display depth cap, the continue-thread route (`/post/:rootPostUnitId/continue/:unitId`) SHALL render the selected reply as the focal post and SHALL request that reply's descendant subtree from the Post API using `subtreeRootPostUnitId`. The page SHALL NOT treat `unitId` as a new `rootPostUnitId`, because descendants retain the original root thread id.

The rendered subtree SHALL visually rebase indentation relative to the focal reply so the first descendant starts at the local root depth instead of preserving the absolute depth from the original root thread.

#### Scenario: Continue thread queries descendants under the anchor
- **WHEN** a user opens `/post/root-1/continue/reply-2`
- **THEN** the page fetches the focal post `reply-2`
- AND the page fetches the descendant subtree with `rootPostUnitId = root-1` and `subtreeRootPostUnitId = reply-2`
- AND the page SHALL NOT fetch a thread with `rootPostUnitId = reply-2`

#### Scenario: Continue thread does not duplicate the focal reply
- **WHEN** the subtree query returns descendants for `reply-2`
- **THEN** the focal reply is rendered once as the page's main post
- AND the reply tree below it contains only descendants, not `reply-2` itself
