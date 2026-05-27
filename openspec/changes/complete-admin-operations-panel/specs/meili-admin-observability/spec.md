## MODIFIED Requirements

### Requirement: Meili observability links to repair workflows

Meili admin pages SHALL show index health, document counts, settings, last sync metadata, drift checks, and links to dry-run or queued repair workflows.

#### Scenario: Admin sees index drift

- **WHEN** drift is detected for the content index
- **THEN** the Meili page SHALL show affected scope and a repair entry point
