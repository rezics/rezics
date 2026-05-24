## Context

`UnitRevision.restoreSource` is optional in the response contract, but when
present it must have this shape:

```ts
{
  kind: "revision";
  unitId: string;
  sequence: number;
  paths: string[];
}
```

The history service currently maps database rows by casting
`row.restoreSource` directly into the DTO. If the database contains `{}` or a
Prisma JSON null sentinel-like value, the service returns `restoreSource: {}`.
Elysia response validation then rejects the entire history response with 422.

That is a read-tolerance bug. `restoreSource` is metadata, not the primary
revision content. Bad optional metadata should not make the revision timeline or
single revision unreadable.

## Approach

### 1. Normalize history restoreSource on read

Add a narrow runtime guard in `package/history/src/revision/revision.service.ts`
before mapping `restoreSource` into DTOs.

Rules:

- return valid `HistoryRestoreSource` unchanged;
- return `undefined` for `null`, `{}`, arrays, Prisma JSON null sentinels, or
  any object missing `kind`, `unitId`, `sequence`, or `paths`;
- filter `paths` only by accepting an all-string array; do not partially repair
  malformed metadata silently;
- optionally log/debug malformed metadata later, but v1 can omit it without
  logging if the service has no local logger pattern.

This keeps the contract unchanged: `restoreSource` remains optional, and valid
metadata remains visible.

### 2. Preserve restore edit semantics

The Book edit page computes `restoreSource` for a new save from:

- the `restoreRevision` search param;
- the loaded revision's `changedFieldKeys`;
- the fields included in the current submit.

If the revision query fails, the page cannot safely know which paths were
restored. It should not submit as a restore-derived edit.

UI behavior:

- Show a destructive alert when `restoreQuery.error` exists.
- The alert should explain that the revision failed to load and the user must
  leave restore mode or retry before saving.
- Disable submit while restore mode is active and the revision query is loading
  or failed.
- If restore mode is active but the revision response lacks `content.payload`,
  treat it as not ready and do not apply/submit restore state.

### 3. Do not couple ordinary editing to history service health

Ordinary Book edit without `restoreRevision` should remain usable even if the
history service is down. Main canonical writes already use `HistoryOutbox` and
should not synchronously call the history service inside the edit transaction.

This change only blocks the restore-history editing mode, because that mode
depends on reading a historical revision first.

## Non-Goals

- Do not change `HistoryRestoreSource` contract shape.
- Do not add a database migration to rewrite old rows unless implementation
  finds many malformed values and a one-time cleanup is clearly warranted.
- Do not redesign history ingestion or the outbox delivery model.
- Do not solve generic mutation cache invalidation; that is covered by
  `fix-legacy-query-cache-coherence`.

## Risks

- Omitting invalid `restoreSource` can hide data quality issues. This is
  acceptable because returning invalid optional metadata currently makes the
  entire revision unreadable. Tests should preserve valid metadata so future
  changes do not drop all restore provenance.
- Disabling submit in restore mode can surprise users if the history service is
  transiently unavailable. The alert should make the state explicit and provide
  a clear path: retry or leave restore mode.
