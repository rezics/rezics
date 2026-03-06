## ADDED Requirements

### Requirement: Organization plugin integration
The auth service SHALL integrate the better-auth `organization` plugin in `src/auth/instance.ts`, enabling organization management endpoints under `/api/auth/organization/*`.

#### Scenario: Organization plugin is loaded at boot
- **WHEN** the auth service starts
- **THEN** the organization plugin SHALL be active and all `/api/auth/organization/*` endpoints SHALL be routable

### Requirement: Organization CRUD
The organization plugin SHALL allow authenticated users to create organizations (becoming the owner), and allow organization owners/admins to update and delete organizations.

#### Scenario: User creates an organization
- **WHEN** an authenticated user calls `POST /api/auth/organization/create` with a name and slug
- **THEN** a new organization SHALL be created and the requesting user SHALL be added as a member with role `owner`

#### Scenario: Owner deletes an organization
- **WHEN** an organization owner calls `POST /api/auth/organization/delete` with the organizationId
- **THEN** the organization, all members, and all invitations SHALL be removed

#### Scenario: Non-owner cannot delete organization
- **WHEN** a member with role `member` or `admin` calls `POST /api/auth/organization/delete`
- **THEN** the request SHALL be denied

### Requirement: Organization-level roles
The organization plugin SHALL define three organization-level roles: `owner`, `admin`, `member`. These roles are scoped to an organization and are independent from global auth roles.

#### Scenario: Organization creator becomes owner
- **WHEN** a user creates a new organization
- **THEN** they SHALL be assigned the `owner` role within that organization

#### Scenario: Organization admin manages members
- **WHEN** a user with organization role `admin` invites or removes members
- **THEN** the operation SHALL succeed

#### Scenario: Organization member cannot manage other members
- **WHEN** a user with organization role `member` attempts to invite or remove members
- **THEN** the request SHALL be denied

### Requirement: Member invitation flow
The organization plugin SHALL support inviting users to an organization via email. Invitations SHALL have statuses: `pending`, `accepted`, `rejected`, `canceled`.

#### Scenario: Admin invites a user by email
- **WHEN** an organization admin calls `POST /api/auth/organization/invite-member` with an email and role
- **THEN** an invitation record SHALL be created with status `pending`

#### Scenario: Invited user accepts invitation
- **WHEN** a user with a pending invitation calls `POST /api/auth/organization/accept-invitation`
- **THEN** the user SHALL be added as a member with the invited role and the invitation status SHALL change to `accepted`

#### Scenario: Invited user rejects invitation
- **WHEN** a user with a pending invitation calls `POST /api/auth/organization/reject-invitation`
- **THEN** the invitation status SHALL change to `rejected` and the user SHALL NOT be added as a member

#### Scenario: Admin cancels a pending invitation
- **WHEN** an organization admin calls `POST /api/auth/organization/cancel-invitation`
- **THEN** the invitation status SHALL change to `canceled`

### Requirement: Member management
The organization plugin SHALL allow organization owners and admins to add members directly, remove members, and update member roles.

#### Scenario: Admin removes a member
- **WHEN** an organization admin calls `POST /api/auth/organization/remove-member` with a memberId
- **THEN** the member SHALL be removed from the organization

#### Scenario: Owner updates a member's role
- **WHEN** an organization owner calls `POST /api/auth/organization/update-member-role` with a memberId and new role
- **THEN** the member's organization role SHALL be updated

#### Scenario: Member leaves organization
- **WHEN** a member calls `POST /api/auth/organization/leave`
- **THEN** the member SHALL be removed from the organization

### Requirement: Active organization context
The organization plugin SHALL support setting an active organization for a user's session. Subsequent organization-scoped operations SHALL use the active organization context.

#### Scenario: User sets active organization
- **WHEN** a user calls `POST /api/auth/organization/set-active` with an organizationId
- **THEN** the user's session SHALL be associated with that organization for subsequent requests

#### Scenario: User lists their organizations
- **WHEN** a user calls `GET /api/auth/organization/list`
- **THEN** the system SHALL return all organizations the user is a member of

### Requirement: Organization schema
The auth service Prisma schema SHALL include models for `Organization` (id, name, slug, logo, metadata, createdAt), `Member` (id, organizationId, userId, role, createdAt), and `Invitation` (id, organizationId, email, role, status, expiresAt, inviterId, createdAt).

#### Scenario: Organization tables exist after migration
- **WHEN** the Prisma migration is applied
- **THEN** the `Organization`, `Member`, and `Invitation` tables SHALL exist in the database with all required columns

### Requirement: Invitation email hook
The organization plugin SHALL be configured with a `sendInvitationEmail` hook. In development mode, this hook SHALL log the invitation details. In production, it SHALL use the existing email infrastructure.

#### Scenario: Invitation email in development
- **WHEN** an invitation is created in development mode
- **THEN** the invitation details (org name, invitee email, inviter name, invitation ID) SHALL be logged to console

#### Scenario: Invitation email in production
- **WHEN** an invitation is created in production mode
- **THEN** an email SHALL be sent to the invitee with organization and invitation details
