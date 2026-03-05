## Why

The auth service (`package/auth`) currently handles identity lifecycle (sign-up, sign-in, sessions, JWKS) and acts as an OAuth 2.1/OIDC provider, but lacks any administrative user management capability. There is no way to list users, ban abusive accounts, manage roles, or organize users into groups — all essential for operating a production identity platform. The `decouple-user-domain-from-auth` change explicitly deferred admin user creation to the auth service ("相关功能将在后续阶段在 auth service 中实现"), and that stage is now.

### Problem

- No admin API exists to list, create, update, ban, or remove users on the auth service.
- No role system exists on the auth service — the `User` model has no `role` field.
- No organizational structure exists for grouping users (e.g., teams within an organization).
- The first admin user cannot be bootstrapped through any API — a manual database operation is required, and this process is undocumented.
- `package/admin` has user management UI that currently calls `package/server` endpoints. The admin backend needs auth-level user management APIs to eventually support this, but migrating `package/admin` is out of scope for this change.

### Goals

- Add better-auth `admin` plugin to `package/auth` for user CRUD, role management, ban/unban, session management, and impersonation.
- Add better-auth `organization` plugin to `package/auth` for multi-tenant organizational structure with members, invitations, and teams.
- Define a GitHub-inspired access control model that is simple but extensible.
- Extend the Prisma schema with all required fields and tables for both plugins.
- Document the first-admin bootstrapping process in `package/auth/README.md`.

### Non-goals

- Migrating `package/admin` UI to use the new auth admin APIs (separate future change).
- Adding `role` to the JWT payload — auth roles and server business roles are independent systems.
- Modifying `package/server` or `package/app` in any way.
- Building a custom admin dashboard UI.

## What Changes

### package/auth

- Add `admin()` plugin to the better-auth instance in `src/auth/instance.ts`.
  - Configures roles: `user`, `admin`, `owner`.
  - Configures a GitHub-inspired access control model with permissions for `user`, `organization`, and `member` resources.
- Add `organization()` plugin to the better-auth instance in `src/auth/instance.ts`.
  - Enables invitations with email sending hook.
  - Configures organization creation, deletion, and member management.
  - Defines organization-level roles: `owner`, `admin`, `member`.
- Extend `prisma/schema.prisma` with:
  - `role`, `banned`, `banReason`, `banExpires` fields on the `User` model (required by admin plugin).
  - `Organization`, `Member`, `Invitation` models (required by organization plugin).
- Update `package/auth/README.md` with first-admin bootstrapping instructions.
- No changes to JWT payload (`definePayload`) — auth roles stay within the auth boundary.

## Capabilities

### New Capabilities

- `auth-admin`: Admin plugin integration providing user CRUD, role management, ban/unban, session management, impersonation, and access control for the auth service.
- `auth-organization`: Organization plugin integration providing multi-tenant organizational structure with members, invitations, roles, and organization-level access control.

### Modified Capabilities

- `independent-auth-server`: The auth server gains two new plugins (admin, organization) which extend its API surface and database schema. Core behavior (JWT issuance, OAuth/OIDC) is unchanged.

## Impact

### Scope

Affected packages:
- `package/auth` (sole target: plugin config, schema migration, README update)

Unaffected packages:
- `package/server` — no changes; auth roles are independent from server business logic.
- `package/app` — no changes; frontend auth flow remains the same.
- `package/admin` — no changes in this phase; UI migration is a separate future change.

### API surface

New endpoints exposed by better-auth plugins (all under `/api/auth/`):
- Admin: `/admin/list-users`, `/admin/get-user`, `/admin/create-user`, `/admin/update-user`, `/admin/remove-user`, `/admin/set-role`, `/admin/ban-user`, `/admin/unban-user`, `/admin/list-user-sessions`, `/admin/revoke-user-session`, `/admin/revoke-user-sessions`, `/admin/impersonate-user`, `/admin/stop-impersonating`, `/admin/set-user-password`
- Organization: `/organization/create`, `/organization/update`, `/organization/delete`, `/organization/get-full-organization`, `/organization/list`, `/organization/invite-member`, `/organization/accept-invitation`, `/organization/reject-invitation`, `/organization/cancel-invitation`, `/organization/remove-member`, `/organization/update-member-role`, `/organization/leave`, `/organization/set-active`, `/organization/has-permission`

### Dependencies

- `better-auth` already at `^1.5.3` — admin and organization plugins are built-in, no new npm dependencies required.

### Database

- Prisma migration required to add admin fields to `User` and create organization tables.
- **Non-breaking**: all new fields have defaults (`role` defaults to `"user"`, `banned` defaults to `false`), and new tables are additive.

### Backward compatibility

- Fully backward compatible. No existing API behavior changes. No JWT payload changes. Existing users automatically get `role: "user"` default.
- First admin must be manually set via database after deployment.
