# Migration notes — tag pin & realm vote

## What changed for API consumers

### `UnitTagDTO` gains four fields

```ts
{
  // existing
  unitId: string;
  tagUnitId: string;
  score: number;
  voteCount: number;
  // NEW
  pinned: boolean;
  position: string | null;
  belowVisibilityThreshold?: boolean;
  createdAt?: string;
  updatedAt?: string;
}
```

### `RealmTagUnitDTO` gains the same four fields plus `score` / `voteCount`

```ts
{
  realmUnitId: string;
  tagUnitId: string;
  unitId: string;
  // NEW (denormalized aggregates)
  score: number;
  voteCount: number;
  pinned: boolean;
  position: string | null;
  belowVisibilityThreshold?: boolean;
  createdAt?: string;
  updatedAt?: string;
}
```

### `RealmTagVoteDTO` is new

`(realmUnitId, userId, unitId, tagUnitId)` composite key, `value: ±1`. Permanent — votes are retained when a member leaves the realm.

## Required code changes

### 1. Replace "official tag" detection

```diff
-if (tag.score >= 1000) markAsOfficial(tag);
+if (tag.pinned) markAsOfficial(tag);
```

The `score >= 1000` sentinel is **gone**. Pinned curation is now expressed via `pinned: boolean` and ordered by `position: string` (base-62 fractional index). Backfilled rows that previously had `score >= 1000` are now `pinned = true` with `score = SUM(TagVote.value)` (often 0 if no community votes existed).

### 2. Sort tag lists pin-first then score-desc

The server returns rows ordered correctly, but client-side mutations (optimistic, manual filters) can disturb the order. Use the helper:

```ts
import { sortTagsByPinThenScore } from "@rezics/api/tag/tag";
const ordered = sortTagsByPinThenScore(tags);
```

### 3. Switch from the legacy attach/detach flow to the new endpoints

| Old                               | New                                                      |
| --------------------------------- | -------------------------------------------------------- |
| `POST /tag/attach`                | `POST /unit-tags` (creation-as-vote, idempotent)         |
| `POST /tag/detach` (admin)        | `DELETE /unit-tags/:unitId/:tagUnitId`                   |
| `POST /tag/vote`                  | `POST /tag-votes`                                        |
| `POST /realm/:id/tags` (mod-only) | `POST /realm-tag-units` (any realm member)               |
| _(no equivalent)_                 | `PATCH /unit-tags/:unitId/:tagUnitId` (admin / owner)    |
| _(no equivalent)_                 | `PATCH /realm-tag-units/...` (admin / realm owner)       |
| _(no equivalent)_                 | `POST /realm-tag-votes` (any realm member, retention)    |
| _(no equivalent)_                 | `GET /admin/low-score-tags` (admin discovery, score asc) |

### 4. Honor the visibility threshold

Rows with `score <= -100` are filtered out of regular-user responses. Privileged callers (platform admin OR `Unit.userId` for global, OR `Realm.owner` for realm) see them with `belowVisibilityThreshold = true` so the UI can render a distinct affordance.

### 5. Tag-in-a-realm requires both writes

Tagging a unit "in" a realm is an **independent double-write** to global UnitTag and the realm's RealmTagUnit. Use the helper:

```ts
const { mutate, retryGlobal, retryRealm, result } = useTagInRealm();
const r = await mutate({ realmUnitId, unitId, tagUnitId });
// r.global.status === "success" | "error" — independent of r.realm
```

Either leg can fail (e.g. user is no longer a realm member, rate-limited). The server enforces no cascade between the two layers; clients must report partial success honestly.

## Backfill & migration safety

The migration is **purely additive**:

- New columns on `UnitTag` and `RealmTagUnit` (`pinned`, `position`, `score`, `voteCount`, timestamps) with defaults.
- New `RealmTagVote` table.
- New indexes on `(unitId, pinned, position)` and `(unitId, score)` for `UnitTag`; equivalent on `RealmTagUnit`; lookup indexes on `RealmTagVote`.
- No destructive operations.

The deploy step backfills legacy `score >= 1000` rows: sets `pinned = true`, assigns a deterministic low `position` (descending legacy score), and resets `score` / `voteCount` from `Σ TagVote.value` and `count(TagVote)` respectively. Idempotent.

## Authority matrix (quick reference)

| Action                       | Allowed                          |
| ---------------------------- | -------------------------------- |
| Create UnitTag               | any logged-in user (vote = +1)   |
| Cast TagVote                 | any logged-in user               |
| Pin / unpin / position       | admin OR `Unit.userId`           |
| Delete UnitTag               | admin OR `Unit.userId`           |
| Create RealmTagUnit          | any realm member (vote = +1)     |
| Cast RealmTagVote            | any realm member (retained)      |
| Pin / unpin RealmTagUnit     | admin OR `Realm.owner`           |
| Delete RealmTagUnit          | admin OR `Realm.owner`           |
| `GET /admin/low-score-tags`  | admin only                       |

If `Unit.userId IS NULL` (system-owned content), only admins can pin/delete.
