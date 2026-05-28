## ADDED Requirements

### Requirement: JWT service admin API exposes operator-safe summaries

JWT service admin APIs SHALL expose safe metadata needed by the admin operations panel while redacting secrets and private key material.

#### Scenario: API returns JWT service detail

- **WHEN** the admin panel requests JWT service detail
- **THEN** the response SHALL include service status and key metadata
- **AND** SHALL NOT include private key material
