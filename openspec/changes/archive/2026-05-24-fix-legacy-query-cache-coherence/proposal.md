## Why

Book editing currently saves successfully on the server but can show stale data
until a hard refresh. In the worse case, the edit page clears its local draft
after a successful save and immediately falls back to stale `bookKeys.detail`
data, making the just-saved fields appear to reset to their previous values.

This is a legacy TanStack Query cache-coherence bug. It must be fixed before the
future `introduce-api-unit-store` work because the Unit Store change is months
away and editors rely on the current query APIs today.

## What Changes

- Add an `api-cache-coherence` capability for the current TanStack Query-based
  API client.
- Patch or invalidate affected domain detail caches when Unit translation writes
  succeed.
- Ensure Book edit flows update `bookKeys.detail(bookId)` before clearing local
  drafts, including source-release updates and translation add/update/delete.
- Avoid writing stale composite DTOs from adjacent or parallel mutations over
  fresher translation data.
- Audit direct `unitApi.upsertTranslation` callers and domain mutations that
  mutate embedded Unit translation data, then update them to invalidate or patch
  all affected active caches.
- Add regression tests for successful Book translation saves, source-release
  changes, and stale in-flight detail responses.

## Capabilities

### New Capabilities

- `api-cache-coherence`: Defines mutation cache synchronization rules for the
  existing TanStack Query client before the Unit Store migration.

### Modified Capabilities

- None.

## Impact

- Affected packages:
  - `package/api`: mutation helpers, affected domain invalidation/patch logic,
    and tests.
  - `package/app`: Book edit save flow and direct Unit translation callers that
    currently bypass domain cache synchronization.
- No dependency on TanStack DB or `introduce-api-unit-store`.
- No optimistic mutation system is introduced; fixes use authoritative mutation
  responses, targeted cache patching, query cancellation, and invalidation.
