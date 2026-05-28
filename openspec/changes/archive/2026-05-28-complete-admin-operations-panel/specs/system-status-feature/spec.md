## ADDED Requirements

### Requirement: System status is integrated into operations dashboard

The system status feature SHALL remain its own safe API/page, and the admin dashboard SHALL embed its summary as one operational signal alongside queues, search drift, governance, and audit summaries.

#### Scenario: Status degraded on dashboard

- **WHEN** system status reports degraded CDC support
- **THEN** the admin dashboard SHALL show the degraded status and link to the full status panel
