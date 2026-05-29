## Why

The `add-poll` change delivered the full poll primitive — `Poll`/`PollOption`/
`PollVote` storage, the `@rezics/contract` DTOs, and the `@rezics/api` client
hooks — but deliberately deferred all rendering ("UI work is a follow-up").
Today `package/app` has zero poll code: a `Unit(type=POLL)` falls through to the
generic metadata dump on the unit page, there is no way to cast a vote, and
there is no way to author a poll. This change makes the completed backend usable
by adding the poll frontend.

## What Changes

- Add a **`poll` feature** under `package/app/src/poll/` (singular folder, per the
  feature standard) with the layered structure `models/ hooks/ components/
  sections/ pages/ index.ts`. A single `<PollView>` renders the display +
  voting surface and is reused by both entry points.
- **Display + voting (`PollView`)** drives rendering from the `PollResultsDTO`
  conditional fields: `voteMode` (SINGLE = re-vote replaces, MULTI = toggle),
  `resultsVisible` (hide tallies for `AFTER_CLOSE` before close), `closed`
  (read-only), `anonymous` (presentation only — only aggregates + the caller's
  own `myVote`), and dual-form options (`label` text, `unitId` rendered as a
  `UnitCard`, or a tombstoned option with both null but a retained
  `voteCount`). A pure-function selector (`models/pollView.ts`) maps the DTO to a
  render state and is unit-tested without React.
- **Authoring (`PollComposer`)** builds a `CreatePollInput`: add/remove/reorder
  options (text via input, unit reference via `UnitPicker`), and set `voteMode`,
  `resultVisibility`, `anonymous`, and `closesAt`.
- **Entry point 1 — standalone Unit page.** A `Unit(type=POLL)` gets a typed
  destination `/poll/:unitId`; the page composes `<PollView>` over the existing
  discussion thread (`PostTreeSection` rooted on the poll unit), mirroring the
  Review/Remark/Excerpt detail pattern. No new threading mechanism. A poll
  creation entry is added at `/poll/new` (tile on the unified create surface).
- **Entry point 2 — in-thread embed.** A post may carry a poll reference in
  `post.extra.poll.unitId`. The composer gains an "attach poll" affordance that
  mints the poll (`useCreatePoll`) then creates the post with the reference set;
  `PostCard`/`PostReply` render `<PollEmbed>` (which reuses `<PollView>`) when
  the reference is present. Because the poll is its own Unit, the embedded card
  deep-links to its standalone page for free.
- **Contract:** add an optional `poll: { unitId }` field to `postExtraSchema`
  (additive; the schema is otherwise closed). No new server endpoint — the
  client sequences the two existing mutations.
- Each component gets a Storybook story; new i18n keys are added. UI follows the
  `rezics-design` skill, `@rezics/ui`, and the design-system specs.

## Capabilities

### New Capabilities

- `poll-ui`: the poll frontend — the `<PollView>` display/voting state machine
  (single vs multi, live vs withheld tallies, open vs closed, named vs
  anonymous, dual-form/tombstoned options), the `<PollComposer>` authoring flow,
  the standalone poll page (poll view + discussion thread), the in-thread
  `<PollEmbed>`, and the poll creation entry.

### Modified Capabilities

- `type-extension-post`: `postExtraSchema` gains an optional `poll.unitId`
  reference; a post carrying it renders an embedded poll in the thread.
- `unit-resolver`: `buildUnitUrl` resolves `Unit(type=POLL)` to the typed
  `/poll/:unitId` destination instead of falling back to the generic unit view.
- `app-creation-workflows`: poll is added as a guided creation flow (create-surface
  tile + `/poll/new` route).

## Impact

- **package/app**: new `src/poll/` feature (models/hooks/components/sections/pages);
  edits to `unit/pages/UnitPage.tsx` (POLL branch), `shared/utils/build-url.ts`
  (POLL case), `create/pages/CreatePage.tsx` (poll tile), the post composer
  (`post/forms/ReplyComposer.tsx`) and post items (`post/components/item/PostCard.tsx`,
  `PostReply.tsx`) for the embed; new routes `/poll/:unitId` and `/poll/new`;
  Storybook stories; i18n keys.
- **package/contract**: additive `poll.unitId` field on `postExtraSchema` in
  `post.ts`. No DTO duplication — the app consumes existing poll DTOs.
- **package/server**: none. The poll domain and the post `extra` write path
  already exist; `extra` is persisted as-is.
- **Reused, not rebuilt**: `@rezics/api/poll` hooks (already do optimistic
  cache writes), `tag/TagInteraction` + `useTagInteractionReducer` (same
  optimistic-vote shape), `engagement/VoteGroup`/`ScoreOverview`,
  `unit/UnitPicker` + `UnitCard`, `PostTreeSection`.
- **Backward compatibility**: purely additive. The `postExtraSchema` field is
  optional, so existing posts and reads are unaffected; no migration required.
