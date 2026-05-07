# auth-organization Specification

## Purpose

This capability has been retired. Auth organization is no longer a Rezics product/account management surface now that main owns the public auth boundary and product account model. Future developer/team organization, OAuth app ownership, member invitations, and member management flows belong to main and SHALL be modeled through main-owned capabilities.

## Requirements

### Requirement: Auth organization is not a product surface
Auth SHALL NOT expose product-facing organization, team, or developer-app ownership behavior. The better-auth organization plugin SHALL NOT be active in the auth service, and `/auth/organization/*` SHALL NOT be a public product contract.

#### Scenario: Frontend needs team or developer organization management
- **WHEN** product code requires organization, team, or developer-app ownership behavior
- **THEN** it SHALL use main-owned routes and main authorization
- **AND** it SHALL NOT depend on auth organization endpoints, schemas, or roles
