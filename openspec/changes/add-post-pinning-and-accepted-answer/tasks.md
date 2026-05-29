## 1. Schema & seed (server)

- [ ] 1.1 Add `PinKind` enum (`ACCEPTED_ANSWER`, `PINNED`; reserve `HIGHLIGHT`) and the `PostPin` model (`scopeUnitId`, `postUnitId`, `kind`, `position`, `byUserId`, `createdAt`) in `package/server/prisma/schema.prisma` with `@@id([scopeUnitId, postUnitId])` and `@@index([scopeUnitId, kind, position])`.
- [ ] 1.2 Create the additive migration; run `prisma:generate`.
- [ ] 1.3 Seed the official question tag (`Unit(type=TAG)` with the reserved slug) in the factory/seed; ensure idempotent reseed.

## 2. Contract

- [ ] 2.1 Add `PinKind` and `PostPinDTO` to `package/contract/src/post.ts`; add the reserved question-tag slug constant.
- [ ] 2.2 Add `pinKind` (and any needed pin metadata) to `PostDTO`; add request schemas for accept/unaccept and pin/unpin.

## 3. Service: pinning & accepted answers (server)

- [ ] 3.1 Implement a single scope-capability check (OP-of-thread, realm moderator/owner) reused by pin and accept.
- [ ] 3.2 Implement pin/unpin (`kind = PINNED`): validate `scopeUnitId` is a thread root and the target is a reply in it (`target.rootPostUnitId == scopeUnitId`, `target.depth ≥ 1`); reject realm-id scopes; enforce `PINNED` authorization; mint `position` via fractional indexing with PK-collision retry.
- [ ] 3.3 Implement accept/unaccept (`kind = ACCEPTED_ANSWER`): gate on Q&A thread (root bears reserved question tag), `target.depth == 1`, `target.parentPostUnitId == target.rootPostUnitId`; allow multiple, ordered by `position`; enforce OP/moderator authorization.
- [ ] 3.4 Add a Q&A-thread detection helper (root post bears the reserved question tag) used by the accept gate and by render.
- [ ] 3.5 Extend thread read to join `PostPin` for the loaded root scope + viewed realm(s) and attach `pinKind` to each post DTO.

## 4. API routes (server)

- [ ] 4.1 Add accept/unaccept and pin/unpin endpoints in `package/server/src/post/post.api.ts` with auth wiring; mount from `index.ts` if needed.
- [ ] 4.2 Update `post.mapper.ts`/`types.ts` to carry `pinKind` and pin ordering through the include shape.

## 5. App rendering

- [ ] 5.1 In `package/app/src/post/models/postTreeRails.ts`, apply the grouping/order rule: `[ACCEPTED_ANSWER, then PINNED, each by position]` ++ `[ordinary by base sort]`, layered on the DB-ordered base.
- [ ] 5.2 Render `pinKind` badges (✓ accepted answer vs 📌 pinned) in the thread view; load `rezics-design` skill for the badge UI.
- [ ] 5.3 Gate accept/pin affordances on viewer capability (OP / moderator-owner); add i18n copy keys.

## 6. Tests & verification

- [ ] 6.1 Service tests: pin authorization matrix, accept gating (non-Q&A rejected, `depth != 1` rejected), multiple accepted answers, scope-membership validation, fractional-position reorder isolation.
- [ ] 6.2 Render tests: promotion precedence and `pinKind` propagation; no-promotion thread renders unchanged.
- [ ] 6.3 Run `bun run check:convention`, `bun run knip`, and `bun test` across `@rezics/server`, `@rezics/contract`, `@rezics/app`.
