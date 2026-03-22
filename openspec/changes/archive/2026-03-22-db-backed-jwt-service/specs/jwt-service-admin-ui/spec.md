## ADDED Requirements

### Requirement: JWT services list page in admin dashboard

The admin dashboard SHALL include a "JWT Services" page accessible from the navigation menu.
The page SHALL display all `JwtService` records in a table with columns for serviceKey,
issuer, audience, isLocalIssuer, and isActive status.

#### Scenario: Admin navigates to JWT services page
- **WHEN** an admin clicks "JWT Services" in the admin navigation
- **THEN** the dashboard SHALL display a table listing all JWT service records

### Requirement: JWT service detail view

The admin dashboard SHALL provide a detail view for each `JwtService` record, showing all
fields and allowing edits to mutable fields (issuer, audience, jwksUrl, jwksPath,
isLocalIssuer).

#### Scenario: Admin views service detail
- **WHEN** an admin clicks a row in the JWT services table
- **THEN** the dashboard SHALL display the full record details with editable fields

### Requirement: Activate and deactivate controls

The admin dashboard SHALL provide activate and deactivate controls for each `JwtService`
record. The controls SHALL call the corresponding API endpoints and refresh the UI state
after success.

#### Scenario: Admin deactivates a service
- **WHEN** an admin clicks the deactivate control for an active service
- **THEN** the dashboard SHALL call `POST /admin/jwt-services/:serviceKey/deactivate`
  and update the displayed status to inactive

### Requirement: UI reflects mutations immediately

After any successful mutation (create, update, activate, deactivate), the admin UI SHALL
invalidate the relevant TanStack Query cache keys and re-fetch to display the current state.

#### Scenario: UI updates after edit
- **WHEN** an admin saves changes to a JWT service record
- **THEN** the dashboard SHALL invalidate query caches for `['jwtServices']` and
  `['jwtServices', serviceKey]` and display the updated data without manual refresh

### Requirement: Follow existing admin module pattern

The JWT services admin module SHALL follow the existing admin feature structure:
page component, route entry in `routes/_admin/`, and navigation menu entry.

#### Scenario: Module structure matches existing patterns
- **WHEN** the JWT services module is added to `package/admin`
- **THEN** it SHALL include a route definition, a page component, and a navigation entry
  consistent with existing admin modules (e.g., token management)
