# P08 — Reading journal, progress and personal library

Status: planned, not implemented. Date: 2026-09-06. Parent: [program and gates](README.md).

## Outcome and baseline

Make U04/U13 useful even without a large social community. Existing `schema/progress.ts`, `api/progress` and Web `features/progress` already distinguish journal entries and current progress. Extend these owners rather than replacing a product journal with an immutable event log.

## Selected behavior

- Distinguish the personal library state (want/reading/completed/etc.), an occurrence of reading/re-reading, journal entries with dates/precision, and current resume position.
- Visiting a page is not reading. Support manual history for paper books, external reading and incomplete dates. Actual reader checkpoints may update progress under explicit user control.
- Journal entries can be edited/deleted by their owner. Catalog audit history is separate and never republished as personal reading history.
- New detailed reading history, notes and checkpoints default private. Preserve explicit legacy visibility and account choices during migration; do not silently publish imported records.
- Add an explicit visibility control at first save and for imports. Sharing a review or public completion summary does not automatically share detailed sessions or private notes.
- Each reading session targets the actual edition/content identity. Equivalent works can group navigation, but progress transfers only through an evidenced content alignment.
- Define cross-device conflict behavior: checkpoints have session, device operation ID and expected revision; stale clients cannot overwrite a later explicitly selected position. Do not use max(page) for deliberate rereads.
- Import/export is a first-release portability feature: versioned REZICS JSON plus a documented CSV adapter for user-owned exports. Preview matches/visibility and unresolved items before applying; retries are idempotent.
- No automatic account scraping or private third-party collection. Source-aware metadata imports and personal record imports are separate processes.
- Versioned export inventory includes library/journal/sessions, current scores, own lists/items/annotations, authored review content and follows, coordinated with P07/P02. Import supports library/journal, current scores and own lists/annotations in the initial contract; authored reviews/follows are export-only initially and must be declared as such in the format/preview. No private third-party records are exported by association.

## Implementation slices

1. Document current journal/date/precision/current-state semantics and create preservation fixtures.
2. Add missing repeat-session/current-position distinctions only where current contracts cannot express them; migrate existing records without inventing dates or reading duration.
3. Implement privacy-safe first-save and library/journal navigation; quick return to the last meaningful record works for externally consumed books too.
4. Add checkpoint concurrency and offline-client reconciliation in each existing client that writes progress. Offline support beyond current clients is optional; data conflicts are not.
5. Implement export, import preview, matching, confirmed apply, unresolved shelf and retry ledger. Default ambiguous matches to unresolved rather than wrong-edition attachment.
6. Bind edition merges/deletions/structure revisions to resumable repair suggestions. Preserve original references in history.
7. Add account export/erasure and retention behavior for private activity, including derived caches and analytics. Coordinate private credentials/identity with P02 and authored/public records with P07. Persist a protected, recoverable erasure/revocation ledger for P10/P11 restoration so an older backup cannot reopen erased data.

## Acceptance

- Record a book read years ago with month-only precision; it remains month-only after export/import.
- Finish a book, start it again and move backward deliberately; current resume reflects the selected session.
- An import interruption followed by retry creates no duplicate sessions, scores or list entries.
- Two devices submit checkpoints in either order; stale updates produce a merge/retry result without data loss.
- A public review references a private entry without exposing the entry's private fields.
- A removed/merged edition remains recognizable in history; no unverified cross-edition progress conversion occurs.
- Full export/import roundtrip preserves IDs where permitted, visibility, dates, notes and unresolved mappings.
- Run progress/import/concurrency/access tests, backend/SDK/affected client typechecks and i18n policy checks. P12 records human acceptance.

## Capacity

History reads use actor/time/ID keysets; current summaries are incremental. For U users × e yearly entries, budget Ue rows plus actual revisions and bounded device retry records. Product retention/deletion determines historical growth; do not retain private activity forever simply for analytics. Plan 500M/3B history/library rows, high-volume imports and extremely active users; impose batch/payload limits rather than an undocumented lifetime-history cap. P10 owns storage and deletion backlog SLOs.
