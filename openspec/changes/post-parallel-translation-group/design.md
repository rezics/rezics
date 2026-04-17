## Context

The `Unit` model currently supports two translation scenarios:

1. **work/release** (BOOK/GAME/MEDIA): a parent work Unit owns `UnitTranslation` rows; each row's `sourceReleaseUnitId` points to the release Unit that supplies content for that language. This is a **converging** model.
2. **language-neutral** (TAG etc.): `isLanguageNeutral = true` causes the Unit to bypass `UnitSupportLanguage` and match any language filter.

POST currently has neither mechanism. Wiki-style POSTs should behave as **parallel** per-language units — each post is a self-contained, monoglot piece of content, and sibling posts in different languages should be navigable as translations of one another. There is no canonical "work" post to hang translation pointers on.

Two problems need to be solved independently:

- **Sibling discovery**: given one post, find its parallel translations.
- **Fast "supported languages" query at scale**: the `Unit` table is projected at 10M+ rows, with only a small fraction being wiki-participating posts. Per-request aggregation across siblings must stay sub-millisecond without polluting existing per-unit abstractions like `UnitSupportLanguage`.

## Goals / Non-Goals

**Goals:**

- Introduce a first-class `TranslationGroup` entity that aggregates parallel POST translations.
- Maintain "one unit per language per group" as a hard invariant.
- Expose a single-PK lookup that returns all supported languages for a group (no JOIN, no fanout over sibling rows).
- Keep `UnitTranslation` and `UnitSupportLanguage` semantics pristine. Neither is repurposed.
- Keep the change purely additive at the DB level. Existing POSTs keep working unchanged.

**Non-Goals:**

- Merging the work/release model into the parallel-translation model. `sourceReleaseUnitId` remains work/release-exclusive.
- Cross-language search dedup in Meilisearch. Each post is still its own searchable document; searching in one language surfaces that language's post only.
- Version/revision history for translations. A post either is in a group or is not; editing a post does not create a new translation record.
- Extending this mechanism to non-POST types in this change. The schema permits it (the FK is on `Unit`, not `Post`), but only POST wiki flow wires it in now.

## Decisions

### 1. Storage model: `TranslationGroup` as a first-class table with a denormalized language array

```prisma
model TranslationGroup {
  id                 String   @id @default(dbgenerated("uuidv7()")) @db.Uuid
  supportedLanguages String[] @db.VarChar(16)
  createdAt          DateTime @default(now())

  units Unit[]
}

model Unit {
  // ... existing fields
  translationGroupId String?           @db.Uuid
  translationGroup   TranslationGroup? @relation(fields: [translationGroupId], references: [id], onDelete: SetNull)

  @@unique([translationGroupId, defaultLanguage])
  @@index([translationGroupId])
}
```

**Rationale:**

- A dedicated entity (not a self-join on `Unit`) makes the concept explicit and gives us a home for future group-level metadata (e.g., canonical language, lock status, translator credits). Cost today is one table + one FK; benefit is a clean semantic seam.
- `supportedLanguages` as a Postgres `text[]` is a deliberate denormalization: it is read every time a wiki page renders the language switcher, and computing it from sibling rows at 10M+ Unit scale requires either a partial index or a JOIN that grows with group size. The array is written only when group membership changes (a rare event).
- The composite unique on `(translationGroupId, defaultLanguage)` is a business invariant, not a performance optimization. Postgres treats NULL-bearing rows as non-duplicate, so standalone units are unaffected.

**Alternatives considered:**

- **A separate `UnitParallelTranslation` index table** (columns: groupId, unitId, language). Rejected because `Unit` already has both `id` and `defaultLanguage` — the index table would be a pure redundancy with no metadata to carry.
- **Storing `translationGroupId` only on `Unit`, no dedicated `TranslationGroup` table**. Works, but every read of "what languages does this topic support" becomes a self-JOIN on `Unit` (even with a partial index). At 10M+ rows that is still sub-millisecond, but cost is less bounded than a small-table PK lookup, and we lose the natural place to attach future metadata.
- **Each post writes `UnitSupportLanguage` rows for every sibling language**. Rejected: breaks the existing semantic of `UnitSupportLanguage` ("this unit's content actually supports language X"). A Japanese post doesn't "support English" in any meaningful sense — its body is Japanese; English requires navigating to the sibling. It also pollutes language-filter searches with ghost matches that require group-dedup logic downstream.

### 2. `supportedLanguages` is maintained transactionally at membership change

On attach / detach / delete, update `TranslationGroup.supportedLanguages` in the same transaction that mutates `Unit.translationGroupId`. The array is derived state; its source of truth is `SELECT defaultLanguage FROM Unit WHERE translationGroupId = G`.

**Rationale:**

- Writes are rare (user-initiated). An extra UPDATE per attach/detach is unnoticeable.
- Reads are hot (post detail renders). Saving one JOIN per post detail view across 10M+ Units is material.
- Keeping both writes in a single transaction avoids any window where the array is out of sync with the membership.

**Risk mitigation**: we add a reconciliation script that recomputes `supportedLanguages` for all groups, callable ad-hoc and optionally as a scheduled sanity check. This is defensive only; the transactional update is the real guarantee.

### 3. Group creation is lazy — no group exists until the second translation is attached

A standalone POST does not own a `TranslationGroup`. Only when a second translation is added does the system:

1. Create the `TranslationGroup` with a fresh `uuidv7` id.
2. Back-fill the original post's `translationGroupId`.
3. Create the new sibling post with the same `translationGroupId`.
4. Set `supportedLanguages` to both languages.

All in one transaction.

**Rationale:** avoids a population of single-member groups (which carry no information) and keeps `TranslationGroup` row count tight.

### 4. `Unit.translationGroupId` is effectively immutable post-assignment; no in-place group switching

Once a Unit joins a group, it cannot be moved to a different group. The allowed transitions are:

- `NULL → G` (join a group, one-way via the attach flow)
- `G → NULL` (detach, also removes the row's contribution from `supportedLanguages`)
- `Unit deleted → cascade onDelete: SetNull` at the FK level, plus application-level logic to recompute `supportedLanguages`

Switching between groups would require manual detach + attach as two separate user actions.

**Rationale:** simplifies sync logic and matches the mental model — a translation belongs to exactly one topic. Saves us from building a group-merge code path that we don't need.

### 5. `sourceReleaseUnitId` stays as-is (naming and semantics)

We previously considered renaming `sourceReleaseUnitId` to a more generic form. Decision: keep it. With `TranslationGroup` handling the wiki case, `sourceReleaseUnitId` is cleanly scoped to work/release. The name is accurate and the field is now spec-locked to BOOK/GAME/MEDIA parent units.

### 6. `isLanguageNeutral` doc comment

Add a Prisma `///` doc comment on the field. The field is easy to forget about because it's only used by TAG; the comment documents its purpose so future readers don't have to search the spec.

## Risks / Trade-offs

- **Denormalization drift** → Mitigation: every mutation path that touches `Unit.translationGroupId` goes through a single service method that also updates `TranslationGroup.supportedLanguages` in the same transaction. Plus a reconciliation script as a belt-and-braces guardrail.
- **Partial index not expressible in Prisma schema** → The `@@index([translationGroupId])` declared in Prisma is a full index over a mostly-NULL column. At 10M Unit rows, that's a meaningful amount of wasted index space. Mitigation: in the generated migration, replace the index with `CREATE INDEX ... WHERE "translationGroupId" IS NOT NULL`. Document this in the migration SQL so future `prisma migrate` runs do not regress it.
- **Cascade on group deletion** → Using `onDelete: SetNull` on `Unit.translationGroupId` means deleting a `TranslationGroup` row orphans its members (they become standalone again). This matches the work/release pattern and avoids accidental mass-deletion of posts.
- **POST delete does not remove the group** → If the last member of a group is deleted, the group row is now empty. Application-level cleanup in the delete path removes the group when it becomes empty. Worst case if skipped: a harmless empty group row.
- **Search index consistency** → Post documents in Meilisearch do not index `translationGroupId` in this change. If later we want group-based features in search (e.g. "other languages of this post" in a result card), we'll need a follow-up to expose the field. Non-blocking.

## Migration Plan

1. Prisma migration:
   - Create `TranslationGroup` table.
   - Add `Unit.translationGroupId` column (nullable).
   - Create composite unique `(translationGroupId, defaultLanguage)` on `Unit`.
   - Create partial index on `Unit(translationGroupId)` via raw SQL in the migration.
2. Regenerate Prisma client.
3. Wire backend service + Elysia routes for attach/detach/list.
4. Update seed (`prisma/seed/mock/posts.ts`) to create at least one multilingual wiki POST group.
5. Frontend: language switcher on post detail (read `supportedLanguages` via new API hook).
6. Spec updates: `unit-translation` (MODIFIED) + new `post-parallel-translation` (ADDED).

**Rollback:** since the change is purely additive, rolling back the migration drops `TranslationGroup` and the new `Unit` column without affecting existing rows. Application code released alongside must degrade gracefully (the language switcher simply does not render if the API is absent).

## Open Questions

- Should we also expose `translationGroupId` on the Meilisearch post document now, pre-emptively? Current answer: no, defer until a concrete UX need appears.
- Does the attach flow require that the attaching user has write permission on both the existing group's posts and the new translation? Current answer: yes, check at service level; detailed permission spec is out of scope here.
