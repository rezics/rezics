## 1. Contract: post extra poll reference

- [ ] 1.1 Add optional `poll: t.Object({ unitId: t.String() })` to `postExtraSchema` in `package/contract/src/post.ts` (additive; keep `rating`/`title`/`book`/`source` unchanged)
- [ ] 1.2 Confirm `PostExtra` type and `postDTOSchema`/`createPostSchema` flow the new field through with no server change; add/adjust a contract test asserting a post round-trips `extra.poll.unitId`

## 2. Poll feature scaffold and models

- [ ] 2.1 Create `package/app/src/poll/` with the standard layout (`models/ hooks/ components/ sections/ pages/`) and an `index.ts` single export
- [ ] 2.2 Implement `models/pollView.ts`: a React-free selector mapping `PollResultsDTO` → render state (vote mode, counts-visible, voting-enabled, per-option form + selection, total for bar proportions)
- [ ] 2.3 Write `models/pollView.test.ts` covering the matrix: SINGLE/MULTI × resultsVisible true/false × closed true/false × anonymous true/false, plus label / unit-reference / tombstoned options

## 3. Voting hook

- [ ] 3.1 Implement `hooks/usePollVote.ts` wrapping `useCastPollVote`/`useWithdrawPollVote`: SINGLE selecting casts/changes; MULTI selecting toggles (cast if absent from `myVote`, withdraw with `optionId` if present)
- [ ] 3.2 Surface pending/disabled state and error from the underlying mutations; rely on their existing cache write + invalidate for refreshed results

## 4. Display components (PollView)

- [ ] 4.1 Implement `components/PollOption.tsx`: render by form (text `label`; `unitId` via `UnitCard`; tombstone placeholder), with vote/withdraw control, selected state, and `voteCount`/bar when counts are visible
- [ ] 4.2 Implement `components/PollView.tsx`: consume the selector + `usePollVote`; render options, SINGLE vs MULTI affordances, withheld-results message (AFTER_CLOSE before close), closed read-only state, and anonymous (aggregates + `myVote` only)
- [ ] 4.3 Add Storybook stories for `PollView` and `PollOption` covering each state (live/withheld, open/closed, single/multi, anonymous, unit/tombstone options)

## 5. Authoring composer

- [ ] 5.1 Implement `components/PollComposer.tsx`: add/remove/reorder options (text input or `UnitPicker` for unit references), settings for `voteMode`/`resultVisibility`/`anonymous`/`closesAt`, and submit-disabled until ≥2 options
- [ ] 5.2 Build the `CreatePollInput` (unit-reference options carry `unitId` and omit `label`) and call `useCreatePoll`; handle success/error
- [ ] 5.3 Add a Storybook story for `PollComposer`

## 6. Entry point 1: standalone poll page

- [ ] 6.1 Implement `pages/PollPage.tsx`: `<PollView>` over `PostTreeSection` rooted on the poll unit (mirror `ReviewDetailSection`/`RemarkDetailSection`)
- [ ] 6.2 Add a `POLL` case to `package/app/src/shared/utils/build-url.ts` → `/poll/:unitId`
- [ ] 6.3 Add the `/poll/:unitId` route and a `/poll/new` route (mounts `PollComposer`); regenerate the route tree
- [ ] 6.4 Add a `type === "POLL"` branch in `unit/pages/UnitPage.tsx` (or rely on the resolver redirect) so a poll renders `PollPage` instead of the generic metadata dump
- [ ] 6.5 Add a poll creation tile to `create/pages/CreatePage.tsx` linking to `/poll/new`

## 7. Entry point 2: in-thread embed

- [ ] 7.1 Implement `sections/PollEmbed.tsx`: fetch via `pollQueries.detail` by `pollUnitId` and render `<PollView>`, with a deep-link to the poll's standalone page
- [ ] 7.2 Render `<PollEmbed>` from `post/components/item/PostCard.tsx` and `PostReply.tsx` when `post.extra?.poll?.unitId` is present; leave posts without it unchanged
- [ ] 7.3 Add an "attach poll" affordance to the post composer (`post/forms/ReplyComposer.tsx`) that opens `PollComposer`, then on submit sequences `useCreatePoll` → `createPost` with `extra.poll.unitId`; surface an error if either step fails
- [ ] 7.4 Add/adjust Storybook stories or fixtures showing a post card with an embedded poll

## 8. Cross-cutting: i18n and exports

- [ ] 8.1 Add i18n keys for all poll copy (vote mode labels, results-hidden message, closed state, anonymous note, composer labels, create tile) — no hardcoded display strings
- [ ] 8.2 Export the public surface from `poll/index.ts`; ensure external consumers (UnitPage, post items, composer, create page) import only through it

## 9. Verification

- [ ] 9.1 Run `bun run check:convention`, `bun run knip`, and `bun run format:check`
- [ ] 9.2 Run `bun test` for `@rezics/app` and `@rezics/contract` (selector matrix + contract round-trip pass)
- [ ] 9.3 Manual check via `bun run dev`: create a poll at `/poll/new`, vote/change/withdraw on its page, embed a poll in a thread, and confirm AFTER_CLOSE/closed/anonymous states render correctly
