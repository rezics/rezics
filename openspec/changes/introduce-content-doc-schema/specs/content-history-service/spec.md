## MODIFIED Requirements

### Requirement: Slot-based editorial payloads
Editorial revision payloads SHALL be slot-based and SHALL use stable slot names such as `unit`, `translations`, `supportLanguages`, `extension`, `credits`, `subjects`, `tags`, and `post`. Long-form content slots SHALL store the canonical `ContentDoc` payload rather than a legacy body string. Payload references to other Units SHALL store ids, not denormalized display names.

#### Scenario: Attribution revision stores entity id
- **WHEN** a credit attribution changes on a book
- **THEN** the revision payload SHALL store the referenced entity Unit id
- **AND** it SHALL NOT copy the entity's current display name into the revision payload

#### Scenario: Wiki revision stores content document
- **WHEN** wiki content is edited
- **THEN** the editorial revision payload SHALL include the post content slot as a `ContentDoc`
- **AND** it SHALL NOT store a legacy `post.body` string

## ADDED Requirements

### Requirement: ContentDoc snapshots preserve schema version
History snapshots for long-form content SHALL preserve the `ContentDoc.schema` and `ContentDoc.version` values exactly as committed by the canonical write.

#### Scenario: Revision reads old content version
- **WHEN** a revision created under `ContentDoc.version = 1` is read after a future schema version exists
- **THEN** the history service SHALL return the stored version 1 payload without migrating it in place
