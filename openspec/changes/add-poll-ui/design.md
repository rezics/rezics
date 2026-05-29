## Context

The `add-poll` change shipped the complete poll backend: `Poll`/`PollOption`/
`PollVote` storage, `@rezics/contract` DTOs (`PollDTO`, `PollResultsDTO`,
`CreatePollInput`, cast/withdraw inputs), and `@rezics/api/poll` hooks
(`pollQueries.detail`, `useCreatePoll`, `useCastPollVote`,
`useWithdrawPollVote`). The vote/withdraw mutations already write the refreshed
`PollResultsDTO` into the detail cache and invalidate it. `package/app` has no
poll code, so a `Unit(type=POLL)` currently renders as the generic
metadata dump in `unit/pages/UnitPage.tsx`, and no authoring path exists.

The read contract is deliberately gated: `PollResultsDTO` exposes `voteMode`,
`resultsVisible`, `closed`, `anonymous`, `totalVotes?`, `myVote`, and dual-form
options (`label` xor `unitId`, or both null for a tombstone). The server already
enforces tally suppression and anonymity; the UI's job is to render what the
contract returns and never re-derive what it withholds.

The app feature standard (`package/app/docs/feature standard.md`) prescribes a
singular feature folder with `models/ hooks/ components/ sections/ pages/
index.ts`, where `models/` is React-free and the feature exposes a single
`index.ts`. The closest existing analogs are the `tag` feature
(`TagInteraction` + `useTagInteractionReducer`, the same optimistic-vote shape)
and the `engagement` feature (`VoteGroup`, `ScoreOverview`).

## Goals / Non-Goals

**Goals:**

- Render and vote on a poll from a single `<PollView>` that is driven entirely
  by the gated `PollResultsDTO`, with a React-free selector for the render
  state.
- Author a poll (`<PollComposer>`) producing a `CreatePollInput`, including
  unit-reference options via the shared `UnitPicker`.
- Two entry points reusing the same `<PollView>`: a standalone poll page
  (poll + discussion thread) and an in-thread embed driven by `post.extra`.
- Stay additive: one optional contract field, no server changes, no migration.

**Non-Goals:**

- Server-side changes to the poll domain or post write path (already exist).
- Ranked/weighted voting, min/max selection enforcement UI, or poll editing
  after creation (out of scope; future changes).
- A bespoke "embed any unit in a post" mechanism — only a typed `poll`
  reference is added to `post.extra`.
- Realm/feed placement design beyond the two entry points listed.

## Decisions

### D1: One `<PollView>`, reused by both entry points (model A)

A poll is a `Unit(type=POLL)`, so it plays the role Review/Remark/Excerpt units
play: a content unit with its own representation plus a discussion thread. The
standalone page composes `<PollView>` over `PostTreeSection` rooted on the poll
unit — a direct parallel to `ReviewDetailSection`/`RemarkDetailSection`. The
in-thread embed wraps the same `<PollView>` in a `<PollEmbed>` section driven by
`post.extra.poll.unitId`.

- **Alternative — poll as a `PostKind`:** rejected. It contradicts `add-poll`
  D1 (a poll IS a Unit, not a post subtype) and would fork rendering.
- **Alternative — two separate view components:** rejected. The display logic
  (the gated state machine) is identical; duplicating it invites drift.

### D2: Render state is a pure-function selector in `models/`

`models/pollView.ts` maps `PollResultsDTO` → a render state (mode, whether
counts are shown, whether voting is enabled, per-option form + selection). It
imports no React, so the full conditional matrix (SINGLE/MULTI ×
visible/withheld × open/closed × named/anonymous × label/unit/tombstone) is
exercised in `pollView.test.ts`. Components render the selector output and own
no branching logic of their own.

- **Why:** the bug-prone part of poll UI is the conditional matrix; isolating it
  in a tested pure function keeps the components thin and the matrix verifiable.

### D3: Voting semantics live in a `usePollVote` hook over the existing mutations

`hooks/usePollVote.ts` wraps `useCastPollVote`/`useWithdrawPollVote`:
- SINGLE: selecting an option casts/changes (one mutation call with `optionId`).
- MULTI: selecting toggles — cast if not in `myVote`, withdraw (`optionId`) if
  already in `myVote`.

The hook relies on the mutations' existing cache write + invalidate for the
refreshed `PollResultsDTO`; the components do not manage tally state. This
mirrors how `TagInteraction` defers to `useCastTagVoteMutation`.

### D4: In-thread embed carried by `post.extra.poll.unitId`

`postExtraSchema` is a closed typed object (`rating`/`title`/`book`/`source`),
so a free reference cannot be smuggled through it; we add an optional
`poll: t.Object({ unitId: t.String() })`. The post write path persists `extra`
as-is, so no server change is needed. Attaching a poll is a two-step client
sequence: `useCreatePoll` to mint the poll unit, then `createPost` with
`extra.poll.unitId`.

- **Alternative — a markdown embed directive (`:::poll{id}`):** rejected as
  heavier (a custom remark plugin in `MarkdownContent`) and unstructured
  compared with a typed `extra` field.
- **Alternative — a new server endpoint that creates poll+post atomically:**
  deferred. The client sequence is sufficient for this change; a convenience
  endpoint can follow if non-atomicity proves painful.

### D5: Typed `/poll/:unitId` route via `buildUnitUrl`

`buildUnitUrl` gains a `POLL` case → `/poll/:unitId`, so the unit resolver
redirects a poll to its standalone page, consistent with every other unit type
having a typed route. `?view=unit` still yields the generic view. A
`/poll/new` route mounts the composer and is surfaced as a tile on the unified
create page.

### D6: Reuse, don't rebuild

`UnitCard` renders unit-reference options; `UnitPicker` selects them in the
composer; `PostTreeSection` provides the discussion thread unchanged;
`engagement` vote primitives and `tag` interaction patterns inform the controls.
Every new component ships a Storybook story; all copy comes from i18n keys.

## Risks / Trade-offs

- **Attach-poll non-atomicity** (poll created, post fails) → surface the error
  and leave the orphan poll as a draft/standalone unit the author can reuse or
  delete; document that a future atomic endpoint can replace the sequence.
- **AFTER_CLOSE leakage in UI** → the UI never infers counts; it renders only
  `resultsVisible`/`voteCount`/`totalVotes` as returned. The withheld-state
  rendering is covered by the selector test, so a regression can't silently
  show hidden tallies.
- **Anonymous de-anonymization** → the contract never serializes the
  voter↔option mapping for anonymous polls; the UI only ever has aggregates +
  `myVote`, so there is nothing to leak. Asserted in the selector test.
- **Tombstoned options** (both `label` and `unitId` null) → handled as a first
  class render branch retaining `voteCount`, not an error path.
- **Embed fan-out reads** → each `<PollEmbed>` issues its own
  `pollDetailQuery`; React Query dedupes by key and the thread typically holds
  few polls, so N+1 is acceptable. Revisit with a batch read only if threads
  routinely embed many polls.

## Migration Plan

1. Add the optional `poll.unitId` field to `postExtraSchema` in
   `package/contract/src/post.ts` (additive; no server or DB change).
2. Build the `package/app/src/poll/` feature (models → hooks → components →
   sections → pages → index), each component with a story.
3. Wire the seams: `buildUnitUrl` POLL case, `/poll/:unitId` and `/poll/new`
   routes, `UnitPage` POLL branch, create-page tile, composer attach-poll, and
   `PostCard`/`PostReply` embed render.
4. Add i18n keys; run `bun run check:convention`, `bun run knip`, and
   `bun test` for the package.
5. Rollback is removing the feature, the routes/seams, and the optional contract
   field; no data depends on them.

## Open Questions

- Should `/poll/new` allow attaching the new poll to a target realm/thread on
  creation, or only mint a standalone poll (with in-thread attach handled solely
  by the composer path)? Lean: standalone-only here; composer path covers embed.
- Does the embedded poll card need an inline "open thread" affordance distinct
  from its deep-link to the standalone page, or is the deep-link enough? Resolve
  during design-system review.
