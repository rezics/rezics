## ADDED Requirements

### Requirement: Auth JWT services page in admin dashboard

The admin dashboard SHALL include an "Auth JWT Services" page accessible from the navigation menu. The page SHALL display all `JwtService` records from the auth service in a table with columns for serviceKey, issuer, audience, isLocalIssuer, and isActive status.

#### Scenario: Owner navigates to auth JWT services page
- **WHEN** an owner clicks "Auth JWT Services" in the admin navigation
- **THEN** the dashboard SHALL display a table listing all JWT service records from the auth service

#### Scenario: Non-owner user does not see auth JWT services navigation
- **WHEN** a user without owner/root role views the admin navigation
- **THEN** the "Auth JWT Services" menu entry SHALL NOT be visible

### Requirement: Auth JWT service detail view

The admin dashboard SHALL provide a detail view for each auth-side `JwtService` record, showing all fields and allowing edits to mutable fields (issuer, audience, jwksUrl, jwksPath, isLocalIssuer).

#### Scenario: Owner views auth service detail
- **WHEN** an owner clicks a row in the auth JWT services table
- **THEN** the dashboard SHALL display the full record details with editable fields

### Requirement: Auth JWT service activate and deactivate controls

The admin dashboard SHALL provide activate and deactivate controls for each auth-side `JwtService` record. The controls SHALL call the auth service endpoints directly and refresh the UI state after success.

#### Scenario: Owner deactivates an auth service
- **WHEN** an owner clicks the deactivate control for an active auth JWT service
- **THEN** the dashboard SHALL call `POST /api/auth/admin/jwt-services/:serviceKey/deactivate` on the auth service and update the displayed status

### Requirement: Direct auth service API communication

The admin dashboard SHALL communicate directly with the auth service for auth-side JWT management. The auth service base URL SHALL be configured via environment variable (reusing the existing auth URL configuration).

#### Scenario: Auth JWT service data loads from auth backend
- **WHEN** the auth JWT services page loads
- **THEN** the dashboard SHALL fetch data from the auth service URL, not from the main server

### Requirement: UI reflects auth JWT mutations immediately

After any successful mutation on auth JWT services, the admin UI SHALL invalidate the relevant TanStack Query cache keys and re-fetch to display the current state.

#### Scenario: UI updates after auth JWT service edit
- **WHEN** an owner saves changes to an auth JWT service record
- **THEN** the dashboard SHALL invalidate query caches for `['authJwtServices']` and `['authJwtServices', serviceKey]` and display the updated data without manual refresh

### Requirement: Follow existing admin module pattern

The auth JWT services module SHALL follow the existing admin feature structure: page component, route entry in `routes/_admin/`, and navigation menu entry consistent with existing admin modules.

#### Scenario: Module structure matches existing patterns
- **WHEN** the auth JWT services module is added to `package/admin`
- **THEN** it SHALL include a route definition, a page component, and a navigation entry consistent with existing admin modules
