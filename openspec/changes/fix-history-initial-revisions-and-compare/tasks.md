## 1. Server History Payload Semantics

- [ ] 1.1 Add focused tests for Book translation title-only edits proving the history outbox payload contains only `translations.<language>.title`.
- [ ] 1.2 Update `package/server/src/unit/translation.service.ts` to build an effective translation history patch from actual changed fields instead of storing the submitted patch body unchanged.
- [ ] 1.3 Add tests for unchanged translation submissions proving no `HistoryOutbox` row is written.
- [ ] 1.4 Audit Book metadata and Entity metadata update writers for the same raw-submission vs effective-patch issue and add focused tests for any affected path.

## 2. Initial Creation Revisions

- [ ] 2.1 Add Book create service tests proving wiki and personal creation write one initial editorial `HistoryOutbox` row in the create transaction.
- [ ] 2.2 Implement Book initial history payload construction for editable unit, extension, and translation fields in `package/server/src/book/book.service.ts`.
- [ ] 2.3 Add Entity create service tests proving wiki and personal creation write one initial editorial `HistoryOutbox` row with the creator as actor.
- [ ] 2.4 Implement Entity initial history payload construction for editable entity and translation fields in `package/server/src/entity/entity.service.ts`.
- [ ] 2.5 Add a regression test proving existing wiki post creation still writes its initial history revision.
- [ ] 2.6 Confirm normal replies, tag-governance writes, reactions, user creation, and generic Unit creation remain outside editorial content history.

## 3. Compare Model

- [ ] 3.1 Add model tests in `package/app/src/book-library/models/historyCompare.test.ts` for object-shaped translation PATCH payloads.
- [ ] 3.2 Update `package/app/src/book-library/models/historyCompare.ts` to normalize both array-shaped and object-shaped translations.
- [ ] 3.3 Add tests for comparing effective states across sparse PATCH revisions, including non-adjacent revisions.
- [ ] 3.4 Implement effective-state reconstruction for Book history compare using existing history revision content reads and sparse patch application.
- [ ] 3.5 Preserve legacy slot-shaped compare behavior with existing tests and add a regression if needed.

## 4. UI Integration

- [ ] 4.1 Update `BookRevisionComparePage` to feed effective base and target states into the compare model.
- [ ] 4.2 Ensure the changed-field nav renders no unchanged translation chips for title-only edits.
- [ ] 4.3 Keep the no-changes empty state only for genuinely equal normalized/effective states.
- [ ] 4.4 Preserve existing unified/split compare mode behavior and accessibility labels.

## 5. Verification

- [ ] 5.1 Run targeted server tests for translation history, Book creation, Entity creation, and wiki post creation.
- [ ] 5.2 Run targeted app model tests for history compare.
- [ ] 5.3 Run `bun run check:convention`.
- [ ] 5.4 Manually verify a new Book shows an initial history revision after ingestion.
- [ ] 5.5 Manually verify a Book title-only edit shows one timeline chip and one compare diff for the title.
