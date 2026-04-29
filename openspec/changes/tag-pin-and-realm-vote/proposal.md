## Why

The current tag system uses a single signal — `UnitTag.score` — for ordering, and the existing pattern for "official" or curated tags is to set the score to a high constant (e.g. 1000). This conflates two distinct intents: (a) community signal of how well a tag fits a unit, and (b) editorial choice about what should appear at the top. Admins/owners cannot promote a tag without effectively faking a community vote, and the global ordering becomes brittle as soon as multiple curators do this.

At the same time, `RealmTagUnit` only exists as a flag-style junction whose creation cascades into the global score. A realm cannot independently express how strongly its members agree with a tag application, and the global score becomes coupled to realm-internal moderation activity. Realms need their own scoring axis; the global score should reflect global consensus only.

This change separates editorial pinning from community scoring, makes the realm tag layer fully symmetric to the global layer (own score, own votes, own moderation), and replaces all server-side cascades between the two layers with a documented client-side double-write protocol.

## What Changes

- **BREAKING**: Remove the "official tag boost via high score" pattern. Curated prominence is now expressed via `pinned: boolean` + `position: string` (fractional indexing), not via inflated score.
- **BREAKING**: `UnitTag` gains `pinned` and `position` fields. Display order becomes: pinned rows first by `position` ascending, then unpinned rows by `score` descending.
- **BREAKING**: `RealmTagUnit` gains `score`, `voteCount`, `pinned`, `position` fields and becomes structurally symmetric to `UnitTag`.
- **BREAKING**: Remove the existing requirement that only realm moderators/owners can create `RealmTagUnit`. Any realm member may create one (mirrors the open-creation rule for `UnitTag`). Pin and delete remain restricted.
- **BREAKING**: Remove the server-side cascade "RealmTagUnit creation MUST cascade to UnitTag (upsert/increment)". The two layers are independent. The client is responsible for issuing both writes when applicable; the server does not couple them.
- Add `RealmTagVote` as the per-member, realm-scoped equivalent of `TagVote`. Eligibility: voter must be a realm member at write time; the vote persists permanently regardless of later membership changes.
- Define authority matrix: anyone may create UnitTag/RealmTagUnit; only platform admin + the unit's owner (`Unit.userId`) may pin/delete UnitTag rows; only platform admin + the realm's owner may pin/delete RealmTagUnit rows. Realm moderators are not granted pin/delete authority in this iteration.
- Define creation-as-vote semantics: creating a `UnitTag` (or `RealmTagUnit`) row simultaneously inserts a corresponding `TagVote` (or `RealmTagVote`) of value `+1` from the actor. Subsequent submissions by other actors increment the same row's score by inserting their own vote. `score = Σ vote.value`, `voteCount = count(vote)` is the single source of truth.
- Define the `score ≤ -100` low-score moderation rule: low-scored relations are hidden from regular users in search/listing endpoints but remain visible to admin/owner. Provide an admin discovery API to list low-score rows. Deletion is unconditional for authorized actors (no score gate); the threshold is purely a discovery/visibility aid.
- Update `shelf-seed-tags`: seed tags use `pinned=true` with a low (early) `position` value instead of `score=1000`. Scores on seed tag UnitTag rows start at `1` like any other.

## Capabilities

### New Capabilities

- `realm-tag-vote`: per-realm, per-member vote records on `(realmUnitId, unitId, tagUnitId)` driving `RealmTagUnit.score`. Includes membership-time eligibility, permanent retention after exit, and the integration rule that creating a `RealmTagUnit` writes the creator's first `RealmTagVote`.

### Modified Capabilities

- `tag-scoring`: add `pinned` + `position` fields to `UnitTag`; remove the "set score to 1000 for official tags" requirement; redefine display ordering as pinned-first/score-second; redefine score derivation as `Σ TagVote.value` (the sole source); define creation-as-vote semantics for `POST /unit-tags`.
- `realm-tag-unit`: add `score`, `voteCount`, `pinned`, `position` fields; remove the moderator/owner-only creation restriction; remove the "RealmTagUnit creation cascades to UnitTag" requirement; specify that lifecycle of `RealmTagUnit` and `UnitTag` is fully independent across both creation and deletion; codify the authority matrix for pin/delete (admin + realm owner only).
- `shelf-seed-tags`: replace the "score ≥ 1000" boost with `pinned=true` + low `position`; align seed tag UnitTag initial score with the unified rule.

## Impact

- **Affected packages**:
  - `package/server` — Prisma schema migration (new columns on `UnitTag`, `RealmTagUnit`; new `RealmTagVote` table); service-layer changes for tag/realm-tag creation, voting, pin/position mutation, deletion, and low-score listing endpoints.
  - `package/contract` — Typebox schemas for `UnitTagDTO`, `RealmTagUnitDTO`, new `RealmTagVoteDTO`; updated request/response shapes for create, vote, pin, delete, low-score list.
  - `package/api` — TanStack Query hooks/options for the new endpoints; client-side double-write helper that fans `tagUnit + realmTagUnit` from a single user action.
  - `package/app` — tag panel uses the new pinned/position ordering; realm-tag context surface adopts symmetric ordering; admin/owner-only UI affordances for pin/delete; surfacing of low-score rows for authorized roles only.
  - `package/admin` — low-score discovery view; pin/delete entry points.
  - Seed scripts under `package/server/prisma` — seed tag installation switches from score=1000 to pinned + position.
- **Database migration**: additive columns are nullable/defaulted (pinned default false, position nullable, score/voteCount default 0 for new RealmTagUnit columns). A backfill step converts any existing UnitTag with score ≥ 1000 (the legacy "official boost") to `pinned=true` with assigned positions; their post-migration score is reset to a community-derivable baseline (1 per legitimate vote, 0 if no votes exist). Existing TagVote rows are preserved and remain authoritative.
- **Backward compatibility**: API consumers reading `UnitTagDTO` see two new fields; they may ignore them and continue to sort by score with no functional regression for unpinned tags. Consumers that previously relied on the score=1000 convention to detect "official" tags must switch to the `pinned` field. The removed `RealmTagUnit` creation restriction is loosening, not tightening, so existing mod/owner-driven flows continue to work.
- **Cross-cutting**: the `realm-tag-context` and `tag-batch-translation` capabilities consume the new ordering implicitly (they already read score and now also read pinned/position) but do not require their own delta — only the producing capabilities (`tag-scoring`, `realm-tag-unit`) define the semantics.
