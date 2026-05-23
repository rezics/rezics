## ADDED Requirements

### Requirement: Content index sources realm tag keys from RealmTagApplication
The content index SHALL source realm-scoped tag machine filter keys from `RealmTagApplication` rows. The field values SHALL preserve the existing compound format `"{realmUnitId}:{tagUnitId}"` unless a separate search contract change renames the field.

#### Scenario: Application produces realm tag key
- **GIVEN** `RealmTagApplication(realm-X, tag-A, unit-1)` exists
- **WHEN** `unit-1` is synced to the content index
- **THEN** the document's realm tag key field SHALL contain `"realm-X:tag-A"`

#### Scenario: Old model name is not used in search code
- **WHEN** a developer audits content indexing code
- **THEN** search sync code SHALL refer to realm tag applications rather than `RealmTagUnit`
