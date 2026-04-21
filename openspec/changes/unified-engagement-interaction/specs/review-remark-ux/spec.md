## MODIFIED Requirements

### Requirement: Reaction counts on reviews and remarks

Both review cards and remark cards (in every list, carousel, and detail context) SHALL render a `<ReactionBar>` (per `engagement-reaction-bar`) using the content-as-artifact action policy. The `ReactionBar` SHALL display the net vote score and the reply count derived from `reactionSummaries` and `replyCount` on the post DTO. Review cards, remark cards, and their detail surfaces SHALL NOT render bespoke count displays (custom like-count `Typography`, `PostReactionFooter`, or `ReactionStatistics`); all count rendering goes through the `ReactionBar` atoms.

#### Scenario: Review card uses ReactionBar

- **WHEN** a `ReviewCard` renders a review with 12 net votes and 3 replies
- **THEN** the card's `<ReactionBar>` renders a vote pill showing "12" and a reply action showing "💬 3"
- **AND** no separate count text (e.g. "12 likes", "3 replies") renders outside the `ReactionBar`

#### Scenario: Remark card uses ReactionBar

- **WHEN** a `RemarkCard` renders a remark with 5 net votes and 1 reply
- **THEN** the card's `<ReactionBar>` renders a vote pill showing "5" and a reply action showing "💬 1"

#### Scenario: Zero counts still render a ReactionBar

- **WHEN** a review or remark has no votes and no replies
- **THEN** the card's `<ReactionBar>` still renders, with the vote pill showing "0" and the reply action showing "💬 Reply" (label instead of count)
- **AND** the card SHALL NOT omit the `ReactionBar` or degrade to a placeholder text

#### Scenario: Review and remark cards are fully interactive via ReactionBar

- **WHEN** a signed-in user clicks the up-arrow on a `ReviewCard` or `RemarkCard`
- **THEN** the vote mutation dispatches via the `VoteGroup` atom internal to `ReactionBar`
- **AND** the outer card navigation to the detail page SHALL NOT fire (click propagation is stopped by `ReactionBar` per the `engagement-reaction-bar` spec)
