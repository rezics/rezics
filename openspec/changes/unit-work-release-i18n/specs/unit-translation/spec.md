## ADDED Requirements

### Requirement: UnitTranslation.sourceReleaseUnitId points to the canonical release for a language

For a Unit that participates in the work/release pattern as a work, each `UnitTranslation` row MAY carry a `sourceReleaseUnitId` referencing one of the work's release Units. This pointer SHALL identify the canonical release whose body content represents the work in that language. The pointer is curatorial: setting or changing it does not move or copy any content; it only changes which release the system considers canonical for that language.

#### Scenario: Set sourceReleaseUnitId on a work's translation

- GIVEN a Work Unit "work-x" with releases "rel-zh" and "rel-zh-revised", both with `defaultLanguage = "zh-hant"`
- AND a `UnitTranslation` exists for `(unitId = "work-x", language = "zh-hant")`
- WHEN the caller invokes `PATCH /units/work-x/translations/zh-hant/source` with body `{ sourceReleaseUnitId: "rel-zh-revised" }`
- THEN the `UnitTranslation` row's `sourceReleaseUnitId` SHALL be updated to `"rel-zh-revised"`
- AND no `Post.body` or other content field SHALL be modified

#### Scenario: Reading the canonical release for a language

- GIVEN a Work Unit "work-x" with `UnitTranslation` for `("work-x", "en")` whose `sourceReleaseUnitId = "rel-en"`
- WHEN a reader requests the work's content in `"en"`
- THEN the system SHALL resolve to the body of release "rel-en"

### Requirement: UnitTranslation cache fields MAY drift from sourceRelease.body

The `title`, `subtitle`, `summary`, and `description` fields of a `UnitTranslation` row SHALL be writable independently of the body of the unit identified by `sourceReleaseUnitId`. The system SHALL NOT auto-recompute these fields when the source release's body changes. Drift between the cached fields and the source body is a permitted state; reconciliation, when desired, is performed by an explicit client action.

#### Scenario: Edit cached title without touching release body

- GIVEN a Work Unit's `UnitTranslation` for `("work-x", "en")` with `title = "Old"` and `sourceReleaseUnitId = "rel-en"`
- AND release "rel-en" has body `Post.body` whose first line is "Old"
- WHEN the caller invokes the standard UnitTranslation update with body `{ title: "New" }`
- THEN the `UnitTranslation.title` SHALL be `"New"`
- AND `Post.body` of "rel-en" SHALL remain unchanged
- AND no validation error SHALL be raised for divergence

#### Scenario: Source release body changes do not propagate to cache

- GIVEN a Work Unit's `UnitTranslation` for `("work-x", "en")` with cached `title = "Old"` and `sourceReleaseUnitId = "rel-en"`
- WHEN the body of "rel-en" is updated
- THEN the `UnitTranslation` row SHALL remain unchanged
- AND retrieval of `("work-x", "en")` SHALL still return `title = "Old"`

### Requirement: PATCH /units/:workId/translations/:lang/source endpoint sets sourceReleaseUnitId

The unit API SHALL expose `PATCH /units/:workId/translations/:lang/source` accepting `{ sourceReleaseUnitId: string | null }`. The endpoint SHALL validate that:

- `:workId` references a Unit with `workUnitId = null` (a work, not a release).
- `sourceReleaseUnitId`, when non-null, references a Unit whose `workUnitId === :workId`.
- The caller has authority over the work via `hasAuthorityOver`.

If validation passes, the system SHALL upsert the `UnitTranslation` row for `(:workId, :lang)` with the new `sourceReleaseUnitId`, leaving any other fields untouched. If the row does not exist, it is created with only `sourceReleaseUnitId` set.

#### Scenario: Source release does not belong to the work

- GIVEN a Work Unit "work-x"
- AND a release "rel-foreign" with `workUnitId = "work-other"` (different work)
- WHEN the caller invokes `PATCH /units/work-x/translations/en/source` with body `{ sourceReleaseUnitId: "rel-foreign" }`
- THEN the request SHALL be rejected with a `400` validation error
- AND no `UnitTranslation` row SHALL be created or modified

#### Scenario: Caller lacks authority over the work

- GIVEN a Work Unit "work-x" owned by user A, with no realm-mod or admin involvement
- WHEN user B invokes `PATCH /units/work-x/translations/en/source` with body `{ sourceReleaseUnitId: "rel-en" }`
- THEN the request SHALL be rejected with `403 Forbidden`
