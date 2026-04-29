## Context

The tag system today (`tag-scoring`, `realm-tag-unit`, `realm-tag-context`, `shelf-seed-tags`) treats `UnitTag.score` as the single, monolithic signal that combines:

1. Net community sentiment (sum of `TagVote.value`).
2. Per-realm endorsements (server-side cascade from `RealmTagUnit` create).
3. Editorial promotion (admin manually setting score to ~1000 to lock in "official" prominence).

Conflating these three causes problems that are now showing up:

- Editorial promotion is indistinguishable from organic consensus, so any consumer reading the score cannot tell why a tag is at the top.
- `RealmTagUnit` creation pollutes the global score, which means realms cannot moderate their own tag space without affecting the global view.
- Realms have no internal score axis: `RealmTagUnit` is currently a flag, with no way to express how strongly a realm's own members agree.
- The "set score to 1000" pattern works only as long as one platform admin maintains it; it does not generalize to per-realm or per-unit owners who legitimately want curatorial influence.

The codebase already enforces some structural separation: `RealmTagUnit` removal does not cascade to `UnitTag`, and votes are recorded in their own table. This change finishes the separation by promoting `RealmTagUnit` into a fully scored, fully voted, fully moderated peer of `UnitTag`, and replaces editorial-via-score with explicit pin/position fields.

## Goals / Non-Goals

**Goals:**

- One unified shape for both layers: `UnitTag` and `RealmTagUnit` carry the same `(score, voteCount, pinned, position)` quartet and the same display-order semantics.
- Score is purely a community signal in each scope. Pinning is a separate editorial axis with its own authorization model.
- Realm members get their own vote axis (`RealmTagVote`) that drives `RealmTagUnit.score` independently of the global score.
- Server-side cascade between the two layers is removed. The client coordinates a documented double-write protocol when applicable.
- Creation of a `UnitTag` or `RealmTagUnit` row is itself the actor's first +1 vote; subsequent submissions by other actors increment the same row.
- Provide a graceful "low-score moderation" path: relations whose score drops to ≤ −100 are hidden from regular users in search/listing endpoints and surfaced to admin/owner via a discovery endpoint, but deletion remains an unconditional admin/owner action with no score gate.
- Migration off the legacy "score=1000 means official" pattern, including the existing seed tags, without losing prominence of those tags during or after the cutover.

**Non-Goals:**

- Granting realm moderators pin/delete authority. Realm moderators continue to exist for other purposes (membership, content moderation), but in this iteration the tag-pin/delete privilege is held only by `Realm.owner` and platform admin. We can revisit if abuse or workload demands it.
- Per-user "personal pin" or per-user re-ordering. Pinning is a curatorial action visible to everyone; user preference is out of scope.
- Auto-deletion or background sweep of low-score relations. Deletion remains a deliberate human action.
- Position rebalancing as part of normal write paths. Fractional indexing keys grow over time; we accept that and defer rebalancing to a maintenance task that is also out of scope here.
- Reworking `realm-tag-context` or `tag-batch-translation` semantics. They consume the new ordering transparently; only the producing capabilities define it.
- Cross-realm pin propagation. A realm pin is local to that realm.

## Decisions

### D1. Two orthogonal axes per relation: score (community) vs pinned+position (editorial)

`UnitTag` and `RealmTagUnit` both gain `pinned: boolean` and `position: string?`. Display order:

```
[ rows where pinned = true, sorted by position asc (lex) ]
[ rows where pinned = false, sorted by score desc, ties stable ]
```

Rationale: pinning is a binary editorial decision; positional ordering only matters among pinned rows because unpinned rows are ordered by community score. Storing `position` only on pinned rows (nullable for unpinned) keeps the schema clean and makes "unpin" a one-field write that drops the row back to the score-ordered region.

Alternatives considered:

- *Single numeric "weight" with admin-controlled boost*: rejected. This is the current pattern and fails for the reasons described in Context.
- *Pin without position (just a boolean flag)*: rejected. Multiple pinned tags need a deterministic order; falling back to score within the pinned section would re-couple to community signal.
- *Integer position with reorder cascades*: rejected. Pin/unpin and reorder are user actions that should be O(1); fractional indexing avoids reorder writes entirely.

### D2. Position uses fractional indexing (LexoRank-style strings)

`position` is a string ordered lexicographically. To pin between existing pinned items A (`"G"`) and B (`"M"`) we generate a key like `"J"` between them. We use the `fractional-indexing` package (or equivalent: it ships a stable algorithm and is widely used). Server validates that incoming positions are valid keys but does not generate them — the client computes new keys based on the neighbors it can see.

Rationale: O(1) inserts, no reorder writes, lets the client be optimistic. Strings drift longer over many rebalances, but rebalancing is out of scope here and the drift is small in practice for tag lists (single-digit pins per unit).

Alternatives considered:

- *Server generates positions*: rejected for the simple case. The client already has the surrounding context (the tag list it is reordering) and the algorithm is deterministic. Server still validates.
- *Floating-point position*: rejected. Mantissa precision runs out after a moderate number of in-between inserts.
- *Linked list (prev/next pointers)*: rejected. Two pointers per row, harder to query in a single SQL pass with `ORDER BY`.

### D3. Score derives solely from votes (single source of truth)

`score = Σ vote.value` and `voteCount = count(vote)` over the corresponding vote table:

- For `UnitTag(unitId, tagUnitId)`: votes from `TagVote` rows matching that pair.
- For `RealmTagUnit(realmUnitId, unitId, tagUnitId)`: votes from `RealmTagVote` rows matching that triple.

Stored values are denormalized for read performance, but the vote table is authoritative; any divergence is a recovery scenario, not a feature.

Rationale: removing the "create increments score by 1" implicit logic in favor of an explicit "create inserts a +1 vote row" makes the invariant easy to state, easy to recover, and easy to audit ("who is responsible for this score?").

Alternatives considered:

- *Score is a free-form integer maintained by service code*: rejected. That is what we have today and it leaks editorial intent into the score.
- *Score is recomputed on every read*: rejected. Read-heavy surfaces (book detail page, search results) cannot afford the scan.

### D4. Creation of a relation row IS the actor's first +1 vote

Concrete rule:

```
POST /unit-tags { unitId, tagUnitId }  by user U:
  if no UnitTag(unitId, tagUnitId):
    create UnitTag (score=1, voteCount=1, pinned=false, position=null)
    create TagVote (userId=U, unitId, tagUnitId, value=+1)
  else:
    create TagVote (userId=U, unitId, tagUnitId, value=+1)
      // composite primary key (userId, unitId, tagUnitId) blocks duplicates
    UPDATE UnitTag set score=score+1, voteCount=voteCount+1

POST /realm-tag-units { realmUnitId, unitId, tagUnitId }  by realm member M:
  symmetric to above, on RealmTagUnit + RealmTagVote.
```

If the actor has already cast a vote on this pair, the create call returns idempotent success without inserting a duplicate vote.

Rationale: the actor's act of submission IS an endorsement. Treating it as a first-class vote keeps "who said yes" traceable in the same table that records every other yes. It also blocks the same actor from artificially inflating score via repeated creates because the vote table's composite PK rejects duplicates.

Alternatives considered:

- *Create with score=0, no vote written*: rejected. The actor is silent in the audit, and a fresh tag with no positive signal sits at score=0 — indistinguishable from a tag everyone disagrees with.
- *Create with score=1 but no vote row (ghost +1)*: rejected. Two sources of truth (the +1 in score, the absence of a vote row to substantiate it), and "Σ vote.value = score" no longer holds.

### D5. The two layers have independent lifecycles; the client double-writes

There is no foreign key between `RealmTagUnit` and `UnitTag`. Server-side cascade (current spec: "RealmTagUnit creation MUST cascade to UnitTag") is removed entirely. Instead, when a realm member tags a unit inside a realm, the client issues two requests:

```
client → POST /realm-tag-units    (realm-scoped relation + vote)
client → POST /unit-tags          (global relation + vote)
```

Each request is independently authoritative. If only one succeeds the system is in a tolerable partial state (e.g. globally tagged but not realm-tagged, or vice versa), and the user/client can retry the missing leg.

Rationale:

- The user cited this exact mental model: the two relations represent two different statements, made by the same actor at the same time, but each with its own life.
- Server-side cascades make the server state opaque; in particular `RealmTagUnit` deletion either had to cascade-delete the `UnitTag` contribution (silently rewrites global history) or not (creates ghost score). Decoupling sidesteps both horns.
- The client is the right coordinator because only the client knows the user's intent: "I am tagging in a realm context" implies both writes; "I am proposing a tag globally" implies only one.

Trade-off: a misbehaving or offline client can leave the system in a partial state. We accept this. The system tolerates the asymmetry: a `UnitTag` may exist with no corresponding `RealmTagUnit`, and vice versa. There are no integrity invariants linking them.

Alternatives considered:

- *Keep server-side cascade but make it best-effort*: rejected. The "best-effort" semantics are precisely what we want the client to own.
- *Single endpoint that performs both writes server-side*: rejected for now. It re-introduces the cascade in a different shape and prevents the client from making the global-only write when that's what the user means.

### D6. Authority matrix

| Action | UnitTag | RealmTagUnit |
| --- | --- | --- |
| Create | any authenticated user | any realm member |
| Vote ±1 | any authenticated user (TagVote) | any realm member at vote time (RealmTagVote, retained on exit) |
| Pin / set position / unpin | platform admin OR `Unit.userId` | platform admin OR `Realm.owner` |
| Delete | platform admin OR `Unit.userId` | platform admin OR `Realm.owner` |

Realm moderators are not granted pin/delete in this iteration. Their existing authority over realm content (via other capabilities) is unaffected.

Rationale: the user-stated principle is "one system serves both user-added and admin/owner-added". Open creation reflects the user-added side; restricted pin/delete reflects the admin/owner side. Decoupling these two sides keeps the score axis honest.

For UnitTag, `Unit.userId` is the existing submitter/owner pointer in the schema. If a unit has no owner (`userId IS NULL`), only platform admin can pin/delete UnitTag rows on that unit.

### D7. Low-score moderation: hide-but-don't-delete

When `score ≤ -100`, the relation:

- Is **excluded** from "list tags for unit" / "find units by tag" / search result endpoints when the caller is a regular user.
- Is **included** in the same endpoints when the caller is an admin, the unit's owner (for UnitTag), or the realm's owner (for RealmTagUnit). Indicate the suppressed status in the DTO via a flag (e.g. `belowVisibilityThreshold: true`) so the client can render it differently.
- Remains in the database with its score and votes intact.

A separate admin discovery endpoint, e.g. `GET /admin/low-score-tags?threshold=-100&scope=global|realm`, lists candidates so admins can sweep periodically without browsing every unit.

Deletion is decoupled from the threshold: any authorized actor (admin / owner per D6) can delete at any time. The threshold is a discovery and visibility aid, not a deletion gate.

Rationale: the score threshold is a community-driven mechanism for hiding noise; deletion is a deliberate moderation act. Coupling them would either auto-delete legitimate-but-unpopular tags or require the score to climb back over -100 before an admin can clean up clearly bad ones.

Alternatives considered:

- *Auto-delete at -100*: rejected. Loses recovery path; opens DoS via coordinated downvotes.
- *Make -100 the deletion gate*: rejected. Admin should be able to delete obvious garbage at score=+5 (e.g. spam tag with a couple stray upvotes).
- *Show low-score rows to all users with a "downvoted" badge*: out of scope. We can layer that later; for now they are suppressed for regular users.

### D8. RealmTagVote eligibility persists past membership

To cast a `RealmTagVote(realmUnitId, userId, ...)`, the user must be a member of `realmUnitId` at the time of the write. Once written, the row is permanent and is not removed if the user leaves the realm. The denormalized `RealmTagUnit.score` continues to reflect the historical vote.

Rationale: matches the principle that scores are accumulative and historically grounded. Stripping votes on exit creates pressure to time-correlate membership and votes, and would let realms be "reset" by mass-leaves. Keeping votes also matches the existing "RealmTagUnit removal does not cascade to UnitTag" stance from current spec — every recorded contribution is permanent.

### D9. Migration off score=1000

Any `UnitTag` row with score ≥ 1000 today is presumed to be a legacy "official boost". Migration step:

1. For each such row, set `pinned = true` and assign `position` values such that the historical relative order (descending by score) is preserved.
2. Reset `score` to `Σ TagVote.value` for that pair (which may be 0 if the tag was added admin-only with no community votes).
3. Reset `voteCount` to `count(TagVote)` for that pair.

After migration, prominence is preserved (those tags are pinned to the top), but the score reflects only real votes. The existing seed tag installation is updated to use `pinned + position` from the start.

The migration is one-way; we do not provide a rollback that re-inflates score to 1000. If the change is reverted before deploy, the seed installer reverts in the same patch.

### D10. Endpoint shape (sketch, not authoritative)

Authoritative shapes belong in the spec deltas. As scaffolding for Decisions and Tasks:

- `POST /unit-tags` (any user): body `{ unitId, tagUnitId }`. Idempotent if the user has already voted. Returns the resulting `UnitTagDTO`.
- `POST /realm-tag-units` (realm member): body `{ realmUnitId, unitId, tagUnitId }`. Same semantics in realm scope.
- `POST /tag-votes` (any user): body `{ unitId, tagUnitId, value: ±1 }`. Upsert on composite PK.
- `POST /realm-tag-votes` (realm member): body `{ realmUnitId, unitId, tagUnitId, value: ±1 }`. Same.
- `PATCH /unit-tags/:unitId/:tagUnitId` (admin or `Unit.userId`): body `{ pinned?: boolean, position?: string|null }`. Pin/unpin/move.
- `PATCH /realm-tag-units/:realmUnitId/:unitId/:tagUnitId` (admin or `Realm.owner`): same shape.
- `DELETE /unit-tags/:unitId/:tagUnitId` (admin or `Unit.userId`): unconditional.
- `DELETE /realm-tag-units/:realmUnitId/:unitId/:tagUnitId` (admin or `Realm.owner`): unconditional.
- `GET /admin/low-score-tags?threshold=-100&scope=global|realm[&realmUnitId=...]` (admin only): listing.

`GET` listing endpoints (existing tag context endpoints) gain a `belowVisibilityThreshold` field on each row and apply the regular-user suppression filter automatically.

## Risks / Trade-offs

- **[Risk] Client misbehavior leaves split state (RealmTagUnit without UnitTag, or vice versa)** → Mitigation: the `package/api` client wraps "tag in realm" as a single function that issues both writes with explicit error reporting per leg; UI can prompt retry of the missing leg. The system tolerates the partial state semantically — there is no integrity check that flags it.
- **[Risk] Fractional-indexing keys grow unboundedly in degenerate insertion patterns** → Mitigation: out of scope for this change; we accept the drift. A future maintenance task can rebalance pinned positions per unit, since the count of pinned items per unit is small (single digits typical).
- **[Risk] Migrating legacy score=1000 rows resets community-derived score to 0 if no votes exist** → Mitigation: those rows are pinned post-migration so display prominence is preserved. The "new" score=0 is honest: no community has voted on them yet.
- **[Risk] Removing the moderator-only creation rule for RealmTagUnit may flood realms with low-quality tags** → Mitigation: RealmTagVote enables per-realm downvoting; the -100 visibility threshold suppresses bad ones; pin/delete remains restricted to owner/admin so curation power is preserved. We can re-tighten creation later if abuse appears.
- **[Risk] Owner-of-unit pin/delete authority for UnitTag may surprise users who don't know who owns a unit** → Mitigation: client surfaces the pin action only for users with the authority (admin or `Unit.userId === me`); for others the action is hidden, not hidden-with-error. Document the authority in user-facing help text.
- **[Trade-off] No realm-mod authority for tag pin/delete** means realm owners become a bottleneck in active realms. We accept this for v1; mods retain authority over other realm aspects. Re-evaluate if the bottleneck materializes.
- **[Trade-off] Creation-as-vote means an actor consumes their vote slot by submitting** — they cannot also "vote +1 on the existing tag they just created". This is fine: the create itself is the +1.
- **[Trade-off] -100 visibility is a hard cutoff, not a smooth fade.** A row at -99 is fully visible; at -100 it disappears. We accept the discontinuity for simplicity. Tunable later.
