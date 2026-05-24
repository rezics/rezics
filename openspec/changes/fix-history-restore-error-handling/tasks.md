## 1. History Service

- [ ] 1.1 Add a runtime guard/normalizer for `HistoryRestoreSource` in the
      history revision mapping path.
- [ ] 1.2 Omit invalid optional `restoreSource` values from timeline and
      single-revision DTOs.
- [ ] 1.3 Preserve valid `restoreSource` values byte-for-shape in responses.
- [ ] 1.4 Add tests for `restoreSource: null`, `{}`, malformed object, and valid
      restore source metadata.
- [ ] 1.5 Confirm timeline response validation no longer fails when legacy rows
      contain invalid optional restore metadata.

## 2. Book Restore Edit UI

- [ ] 2.1 Show a destructive alert when `restoreQuery.error` exists in Book edit
      restore mode.
- [ ] 2.2 Disable submit while restore mode is active and the revision query is
      loading, failed, or missing required content payload.
- [ ] 2.3 Ensure normal edit mode without `restoreRevision` remains submit-able
      regardless of history query state.
- [ ] 2.4 Ensure failed restore mode does not attach `restoreSource` metadata to
      a save.
- [ ] 2.5 Add focused UI/unit tests for failed restore query and loading restore
      query states if the existing test harness supports the page.

## 3. Verification

- [ ] 3.1 Run targeted history service tests.
- [ ] 3.2 Run targeted Book edit tests.
- [ ] 3.3 Run `bun run check:convention`.
- [ ] 3.4 Manually verify:
      - history timeline with malformed legacy `restoreSource`;
      - single revision read with valid `restoreSource`;
      - Book restore edit success path;
      - Book restore edit failure path.
