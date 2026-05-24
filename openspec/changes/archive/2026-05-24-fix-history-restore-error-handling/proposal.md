## Why

History reads can fail response validation when old or malformed rows contain an
invalid `restoreSource`, for example `{}` instead of
`{ kind: "revision", unitId, sequence, paths }`. This currently surfaces as a
422 validation response from the history service.

The Book restore-edit flow also does not clearly surface history read failures.
When a user opens edit mode from a revision, the page may show a restore notice
without telling the user that the revision payload failed to load. That makes
history-related failures look like silent edit failures or stale UI state.

## What Changes

- Normalize optional `restoreSource` values returned by the history service so
  malformed or legacy empty values do not break response validation.
- Add regression coverage for history timeline and single-revision responses
  containing null/empty/malformed `restoreSource` values.
- Surface restore revision query errors in the Book edit page.
- Prevent restore-mode submission when the requested revision failed to load or
  has not loaded enough data to compute restore metadata safely.
- Keep normal canonical editing independent from history service availability;
  history read failures affect restore-history workflows, not ordinary edits.

## Capabilities

### New Capabilities

- `content-history-restore-ux`: Defines response tolerance and UI failure
  handling for history-backed restore editing.

### Modified Capabilities

- None.

## Impact

- Affected packages:
  - `package/history`: revision mapping/normalization and tests.
  - `package/app`: Book edit restore-mode error display and submission guard.
  - `package/contract`: only if a shared helper/schema guard is needed; no
    contract shape change is intended.
- Compatibility:
  - Existing valid `restoreSource` payloads continue to return unchanged.
  - Invalid legacy values are omitted from responses rather than returned as
    broken objects.
