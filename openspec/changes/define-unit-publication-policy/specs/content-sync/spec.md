## ADDED Requirements

### Requirement: Content sync preserves public eligibility
Content index sync SHALL add or update only Unit documents that are public eligible.

#### Scenario: Full content sync runs
- **WHEN** full content sync reads Unit-backed content
- **THEN** it SHALL index only Units with `status=PUBLISHED` and `visibility=PUBLIC`

#### Scenario: Single content sync sees ineligible Unit
- **WHEN** single content sync processes a Unit that is deleted, draft, archived, private, or unlisted
- **THEN** it SHALL remove that Unit document from the content index

### Requirement: Partial content sync cannot create ineligible public documents
Partial content sync paths SHALL NOT upsert content-index documents for Units that are not public eligible.

#### Scenario: Private shelf membership changes
- **WHEN** membership changes for a private shelf
- **THEN** partial sync SHALL NOT create a public content-index document for that shelf

#### Scenario: Public eligibility may have changed
- **WHEN** a partial sync path cannot prove the target Unit is still public eligible
- **THEN** it SHALL use an eligibility-aware sync path or delete the target document
