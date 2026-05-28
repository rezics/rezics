## ADDED Requirements

### Requirement: Auth pages are part of account operations

Admin auth users, sessions, status, and JWT service pages SHALL be grouped under account/platform security operations with consistent filters, tables, audit-aware actions, and reconciliation warnings.

#### Scenario: Admin opens auth users

- **WHEN** an admin opens the auth users page
- **THEN** the page SHALL show role, ban/session state, main-user linkage, enforcement summary, and available account actions
