## MODIFIED Requirements

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
