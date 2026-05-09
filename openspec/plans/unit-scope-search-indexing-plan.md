# Unit Scope Search Indexing Plan

**Status**: Draft plan, pre-proposal  
**Date**: 2026-05-09  
**Scope**: Unit-level discoverability semantics for scoped search, especially
book/post tree search and Meilisearch projections

---

## 1. Context

The earlier search scope plan described book-scoped post search as:

> Search posts where `targetUnitId = bookId`.

That is not enough for the desired product semantics.

When a user searches within a book, the expected result set is not only posts
that directly target the book. It should also include public content under those
posts, such as review comments and nested replies.

Example:

```text
Book B
└─ Review R
   ├─ Comment C1
   │  └─ Reply C2
   └─ Comment C3
```

Searching within `Book B` should include:

- `Review R`
- `Comment C1`
- `Reply C2`
- `Comment C3`

Searching within `Review R` should include:

- `Review R`
- `Comment C1`
- `Reply C2`
- `Comment C3`

Searching within `Comment C1` should include:

- `Comment C1`
- `Reply C2`

This means scoped search needs a discoverability closure, not only direct target
matching.

---

## 2. Current Model

### 2.1 Post tree fields

The current `Post` model has:

- `targetUnitId`
- `rootPostUnitId`
- `parentPostUnitId`
- `depth`
- `sortPath`

The Meilisearch post index currently projects and filters:

- `targetUnitId`
- `realmIds`
- `authorUserId`
- `rootPostUnitId`
- `parentPostUnitId`
- `kind`
- `depth`
- `isLocked`

These fields support several useful queries, but each has a narrower meaning:

| Field | Good For | Limitation |
| --- | --- | --- |
| `targetUnitId` | Directly-about/attached-to queries | Does not include descendants unless every descendant repeats the same target |
| `rootPostUnitId` | Whole root thread queries | Cannot search an arbitrary middle subtree |
| `parentPostUnitId` | Direct child queries | Does not include deeper descendants |
| `sortPath` | Ordering and tree display | Not a practical Meilisearch prefix-subtree filter |

### 2.2 Current gap

The existing fields cannot express:

> Find all searchable Units that should appear when searching within Unit X.

That relation is not always the same as direct target, root thread, or direct
parent.

---

## 3. Required Semantics

### 3.1 `targetUnitId`

`targetUnitId` should mean:

> The direct semantic target of this Unit: the primary Unit this Unit is about,
> attached to, reviewing, excerpting from, replying to, or representing.

Properties:

- It is a direct edge.
- It points to one Unit.
- It is not a transitive ancestor list.
- It should not be overloaded to mean "all scopes where this Unit can be found".

Examples:

```text
Review R about Book B:
  R.targetUnitId = B

Comment C1 replying to Review R:
  C1.targetUnitId = R

Reply C2 replying to Comment C1:
  C2.targetUnitId = C1

Chapter CH of Book B:
  CH.targetUnitId = B
```

This makes `targetUnitId` useful for direct relationship queries:

```text
Find content directly targeting Book B.
Find comments directly attached to Review R.
Find chapters directly belonging to Book B.
```

It should not be used as the only mechanism for scoped search.

### 3.2 `scopeUnitIds`

`scopeUnitIds` should mean:

> The derived search/discovery containment closure: Units whose scoped search
> should include this Unit.

Properties:

- It is many-valued.
- It is derived, not manually authored business data.
- It is optimized for search filtering.
- It may include the Unit itself, so searching "within this post" can include
  the post as well as descendants.
- It should be filterable in Meilisearch, not searchable text.

Example:

```text
Book B
└─ Review R
   └─ Comment C1
      └─ Reply C2
```

Search projection:

```text
R.scopeUnitIds  = [B, R]
C1.scopeUnitIds = [B, R, C1]
C2.scopeUnitIds = [B, R, C1, C2]
```

Then scoped search becomes:

```text
Search within Book B:
  filter: scopeUnitIds = B

Search within Review R:
  filter: scopeUnitIds = R

Search within Comment C1:
  filter: scopeUnitIds = C1
```

### 3.3 Canonical source vs search projection

`scopeUnitIds` should be treated as a search projection, not necessarily the
canonical source of relationship truth.

The canonical model should be Unit-level, not post-only. A future canonical
structure could be a Unit relation or Unit scope table such as:

```text
UnitScope
────────────────────────────────────────────
unitId          Unit being discovered
scopeUnitId     Unit whose scoped search includes unitId
relation        SELF | TARGET | ANCESTOR | CONTAINED_BY | REALM | ...
depth           Optional distance from scope
source          POST_TREE | SHELF_ITEM | REALM_UNIT | CHAPTER | ...
createdAt
updatedAt
```

The Meilisearch document can then denormalize:

```text
scopeUnitIds = UnitScope rows for this unitId
```

This keeps the product model general while keeping the search query path fast.

---

## 4. Why Query-Time Expansion Is Not Preferred

An alternative is to expand the subtree at query time:

```text
1. Query PostgreSQL for all descendants of scope Unit X.
2. Build a large list of descendant Unit IDs.
3. Send a Meilisearch filter such as id IN [...]
4. Search and paginate.
```

This is less attractive because:

- the filter can become very large;
- PostgreSQL and Meilisearch both do work on every search request;
- pagination and relevance ranking become harder to reason about;
- large subtrees make query latency unpredictable;
- cache behavior is worse than a stable filterable field.

`scopeUnitIds` shifts this cost to indexing and keeps scoped search as:

```text
keyword + scopeUnitIds = X
```

That is the shape Meilisearch handles well.

---

## 5. Write Complexity Analysis

Query performance is not the main concern. The critical question is whether
scope closure maintenance makes common write operations too expensive.

Definitions:

```text
N = total searchable Units
S = size of a subtree
D = ancestor depth of a Unit
C = direct child count
M = number of descendants affected by a structural mutation
A = ancestor count of the new parent/scope
```

### 5.1 Operation complexity table

| Operation | Affected Documents | Complexity | Request-Path Suitability |
| --- | ---: | ---: | --- |
| Create top-level post/review targeting a book | New Unit only | `O(D)`, usually `O(1)` | Suitable |
| Create comment/reply under parent | New Unit only | `O(parent scope length)` = `O(D)` | Suitable |
| Edit body/title/rating/metadata | Current Unit only | `O(1)` | Suitable |
| Delete leaf Unit | Current Unit only | `O(1)` or tombstone | Suitable |
| Delete subtree | Subtree | `O(S)` | Batch or async preferred |
| Retarget leaf Unit | Current Unit only | `O(A)` | Suitable for small cases |
| Retarget Unit with descendants | Descendants | `O(M * A)` or `O(M * D)` | Not suitable synchronously |
| Move subtree to another parent | Descendants | `O(M * A)` | Not suitable synchronously |
| Merge/split large scopes, such as books | Large affected set | `O(S * D)` or worse | Offline/async only |
| Full backfill/rebuild | All searchable Units | `O(N * avgD)` | Offline/async only |

### 5.2 Key observation

Closure is ancestor-derived data. Any mutation that changes an ancestor edge can
change the scope closure of every descendant.

Example:

```text
Before:

Book A
└─ Review R
   └─ C1
      └─ C2

C2.scopeUnitIds = [A, R, C1, C2]

Move R under Book B:

Book B
└─ Review R
   └─ C1
      └─ C2

R, C1, and C2 all need scope recalculation.
```

This is the unavoidable `O(subtree size * ancestor depth)` class of operation.

---

## 6. Feasibility Boundaries

### 6.1 Synchronously feasible

These operations are suitable for normal request-path handling:

- creating a top-level post/review/excerpt/remark;
- creating a comment or reply;
- editing searchable text or metadata on one Unit;
- updating author display fields through partial search sync;
- deleting or tombstoning a leaf Unit;
- retargeting a leaf Unit when no descendants inherit its scope.

These are bounded to one Unit or require only reading the parent scope.

### 6.2 Async feasible

These operations are feasible, but should be handled by outbox/job processing or
batch sync:

- deleting a subtree;
- rebuilding scope closure for a subtree;
- retargeting a Unit with descendants;
- moving a subtree;
- repairing corrupted scope projections;
- backfilling existing data;
- reindexing affected descendants after a canonical relation change.

The API may commit the canonical relation change first, then enqueue a scope
projection rebuild. Search results may be temporarily stale.

### 6.3 Not feasible as synchronous guarantees

The system should not promise immediate search consistency for:

- arbitrary large subtree moves;
- arbitrary large subtree retargets;
- book merge/split operations that affect many descendant posts;
- full closure rebuilds;
- any operation that rewrites thousands of Meilisearch documents in the user
  request path.

These operations are product-valid, but they must be treated as structural
maintenance with asynchronous projection repair.

---

## 7. No Product Depth Limit Required

This plan does not require adding a hard post depth limit.

However, without a hard limit, the system must accept the mathematical cost of
deep chains:

```text
Depth 10,000 chain:
  deepest node has about 10,000 scope ids
  total closure storage can approach O(N²) for a pathological chain
```

The mitigation should be operational rather than product-level unless product
requirements later choose otherwise:

- keep `scopeUnitIds` as a derived projection;
- rebuild asynchronously;
- process batches with bounded size;
- monitor scope array length and index document size;
- avoid synchronous subtree rewrites;
- design repair jobs to be resumable and idempotent.

If a future limit is introduced, it should be a general Unit relationship policy,
not a search-specific workaround.

---

## 8. Recommended Architecture

### 8.1 Conceptual model

```text
Unit
  ├─ direct semantic relation
  │    └─ targetUnitId
  │
  ├─ canonical discoverability relation
  │    └─ UnitScope / UnitRelation rows
  │
  └─ search projection
       └─ scopeUnitIds on Meilisearch documents
```

### 8.2 Search document projection

Post search documents should eventually include:

```ts
{
  id: string
  targetUnitId: string | null
  rootPostUnitId: string | null
  parentPostUnitId: string | null
  scopeUnitIds: string[]
}
```

Meilisearch settings:

```text
filterableAttributes += ["scopeUnitIds"]
searchableAttributes should not include "scopeUnitIds"
```

### 8.3 Scoped search behavior

```text
Book-scoped search:
  post index where scopeUnitIds = bookId
  content index where scopeUnitIds/containedUnitIds includes bookId

Post-subtree search:
  post index where scopeUnitIds = postUnitId

Realm-scoped search:
  content/post index where realm scope relation includes realmUnitId
  or existing realmIds projection if that remains sufficient

User-scoped search:
  direct authored/published content, likely still using userId/authorUserId
  rather than scopeUnitIds unless "within user" becomes a Unit scope relation
```

### 8.4 Creation algorithm

For a new Unit with a parent/direct target:

```text
if no parent/target scope:
  scopeUnitIds = [self]

if parent scope exists:
  scopeUnitIds = parent.scopeUnitIds + [self]

if direct target contributes a scope:
  scopeUnitIds = target.scopeUnitIds? + [target, self]
  or a canonical UnitScope resolver computes the exact closure
```

The exact resolver should be defined by Unit relation type. Not every relation
should necessarily inherit every target's full scope.

---

## 9. Design Decisions To Make

1. Should `targetUnitId` for replies point to the direct parent post, while book
   containment is represented only through scope?

   Recommendation: yes. Keep `targetUnitId` direct.

2. Should `scopeUnitIds` include the Unit itself?

   Recommendation: yes. It enables "search within this post" to include the
   post itself and its descendants.

3. Should `scopeUnitIds` be canonical DB data or only search projection?

   Recommendation: search projection. Keep canonical relation data in a general
   Unit-level relation/scope model.

4. Should structural mutations block until search projections are fully updated?

   Recommendation: no for large subtree mutations. Use async projection repair
   and expose eventual consistency.

5. Should the first implementation add a full `UnitScope` table?

   Recommendation: only if the proposal scope includes canonical Unit relation
   modeling. A smaller first implementation may compute `scopeUnitIds` during
   post sync, as long as the design treats it as derived and rebuildable.

---

## 10. Risks

### 10.1 Pathological depth

Very deep chains can create large scope arrays and high total closure storage.
This is a general closure-model risk, not specific to Meilisearch.

### 10.2 Structural write amplification

Subtree move/retarget operations can require rewriting every descendant's scope
projection.

### 10.3 Temporary search inconsistency

If structural mutations are processed asynchronously, scoped search may briefly
show old membership.

### 10.4 Semantic drift

If `targetUnitId` and `scopeUnitIds` are not clearly defined, future code may
start using direct target fields as scope fields again.

---

## 11. Future OpenSpec Change Candidates

1. `unit-scope-semantics`
   - Define `targetUnitId` and Unit-level discoverability semantics.
   - Decide whether to introduce a canonical `UnitScope`/`UnitRelation` table.

2. `post-search-scope-projection`
   - Add `scopeUnitIds` to post search documents.
   - Configure Meilisearch filterable attributes.
   - Backfill existing post documents.
   - Add scoped post search contracts.

3. `scoped-search-eventual-consistency`
   - Define async projection repair behavior.
   - Define outbox/job requirements for subtree retarget/move/rebuild.
   - Define monitoring and retry behavior.

4. `content-scope-projection`
   - Extend similar scope semantics to shelves, chapters, realm content, and
     other content-like Unit types.

---

## 12. Summary

`targetUnitId` and `scopeUnitIds` should not be treated as competing names for
the same idea.

```text
targetUnitId:
  direct semantic edge
  cheap to set
  dangerous to overload as transitive search scope

scopeUnitIds:
  derived discoverability closure
  cheap to query
  cheap for append-style creation
  expensive for large structural mutations
```

The model is feasible if scoped search accepts an asynchronous projection model
for structural changes. It is not feasible to promise synchronous search
consistency for arbitrary large subtree moves, retargets, merges, or closure
rebuilds.

