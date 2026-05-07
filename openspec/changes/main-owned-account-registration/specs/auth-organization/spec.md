## REMOVED Requirements

### Requirement: Organization plugin integration
**Reason**: Auth organization is no longer a Rezics product/account management surface now that main owns the public auth boundary and product account model.
**Migration**: Remove the better-auth organization plugin from auth startup and remove public product usage of `/auth/organization/*`.

### Requirement: Organization CRUD
**Reason**: Product organization/team management belongs in main, where main permissions, user state, and developer app ownership live.
**Migration**: Future developer/team organization routes SHALL be implemented in main.

### Requirement: Organization-level roles
**Reason**: Auth organization roles are not the same as Rezics product roles and should not authorize product behavior.
**Migration**: Use main-owned role and membership models for any future organization/team product features.

### Requirement: Member invitation flow
**Reason**: Organization invitation emails are product flows, not auth credential/session flows.
**Migration**: Future invitations SHALL be implemented through main-owned organization/developer-team capabilities.

### Requirement: Member management
**Reason**: Membership management requires main product authorization and should not be hidden inside auth.
**Migration**: Replace any product dependency on auth member routes with main routes.

### Requirement: Active organization context
**Reason**: Active organization context is not part of user authentication for Rezics product sessions.
**Migration**: Product-specific active organization/team context SHALL be modeled in main if needed.

### Requirement: Organization schema
**Reason**: Auth organization tables are no longer needed after removing auth-owned organization behavior.
**Migration**: Drop or ignore `Organization`, `Member`, and `Invitation` from the auth Prisma schema in the breaking cutover.

### Requirement: Invitation email hook
**Reason**: Auth no longer sends organization invitations.
**Migration**: Product invitations SHALL use main-owned notification/email flows when implemented.
