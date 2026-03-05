## Context

Current state:
- `package/auth` runs as a dedicated IdP with better-auth, ES256 JWKS, OAuth 2.1/OIDC, and Prisma/PostgreSQL.
- The auth instance (`src/auth/instance.ts`) configures two plugins: `jwt` and `oauthProvider`.
- The `User` model has: `id`, `slug`, `name`, `email`, `emailVerified`, `image`, `createdAt`, `updatedAt`. No role, ban, or organization fields exist.
- No admin or user management API exists. No organizational structure exists.
- `package/admin` has user management UI pages (`UserListPage`, `UserEditPage`, `UserCreatePage`) that call `package/server` — migrating these is out of scope.
- The `decouple-user-domain-from-auth` change explicitly deferred admin user management to the auth service.

Constraints:
- Auth roles (`admin`, `user`) are independent from server business roles — `role` MUST NOT enter the JWT payload.
- `package/server` and `package/app` are not modified in this change.
- The access control model should be GitHub-inspired: simple, practical, not over-engineered.

## Goals / Non-Goals

**Goals:**
- Integrate better-auth `admin` and `organization` plugins into `package/auth`.
- Define a clean access control model inspired by GitHub's permission model.
- Extend the Prisma schema with all required fields and tables.
- Generate and apply database migration.
- Document first-admin bootstrapping in README.

**Non-Goals:**
- Migrating `package/admin` UI to use new auth admin APIs.
- Adding role to JWT payload.
- Building custom admin dashboard.
- Implementing dynamic access control or team features (can be enabled later).

## Decisions

### 1) Access control model: GitHub-inspired flat roles with resource permissions

Decision:
- Three global roles: `owner`, `admin`, `user` (default).
- Permission resources and actions:

| Resource       | Actions                          | owner | admin | user |
|----------------|----------------------------------|-------|-------|------|
| `user`         | `list`, `get`, `create`, `update`, `delete`, `ban`, `set-role`, `impersonate` | ✓ | ✓ | — |
| `organization` | `create`, `update`, `delete`     | ✓ | ✓ | create only |
| `member`       | `invite`, `remove`, `update-role`| ✓ | ✓ | — |
| `invitation`   | `cancel`                         | ✓ | ✓ | — |

- `owner` has full permissions on all resources.
- `admin` has the same as `owner` except cannot `impersonate` other admins/owners (better-auth default behavior).
- `user` can create organizations (becomes org owner) but cannot manage other users globally.

Rationale:
- GitHub uses a simple `owner > admin > member` hierarchy. This fits our needs without introducing complex permission trees.
- The admin plugin's built-in RBAC system supports this directly via `ac` (access control) configuration.

Alternatives considered:
- Fine-grained per-resource ABAC: rejected — over-engineering for current stage.
- Two roles only (`admin`/`user`): rejected — `owner` provides a clear super-admin distinction for platform operators.

### 2) Organization-level roles: owner/admin/member

Decision:
- Organization roles mirror GitHub's model:
  - `owner`: full control over the organization, can delete it.
  - `admin`: can manage members and invitations, cannot delete org.
  - `member`: read-only access, no management capabilities.
- Use better-auth's built-in organization access control, not dynamic roles (keep it simple).

Rationale:
- Simple three-tier model covers all practical use cases. Dynamic roles can be enabled later if needed.

Alternatives considered:
- Enable dynamic access control from the start: rejected — adds schema complexity (role table) without current need.
- Enable teams: rejected — can be enabled later when there's a use case.

### 3) Plugin configuration approach

Decision:
- Import `admin` from `better-auth/plugins` and `organization` from `better-auth/plugins`.
- Configure `admin()` with `ac` (access control) and `roles` definitions.
- Configure `organization()` with a `sendInvitationEmail` hook (stub that logs in dev, uses existing email infrastructure in prod).
- Both plugins are added to the `plugins` array in `instance.ts` alongside existing `jwt` and `oauthProvider`.

Rationale:
- Both plugins are built into better-auth — no additional dependencies needed.
- Adding to the existing plugins array is the standard integration pattern.

### 4) Prisma schema extension strategy

Decision:
- Add fields to the existing `User` model: `role` (String, default `"user"`), `banned` (Boolean, default `false`), `banReason` (String?), `banExpires` (DateTime?).
- Add new models: `Organization`, `Member`, `Invitation`.
- Field names and types follow better-auth's expected schema exactly to ensure compatibility with the Prisma adapter.
- Generate a single Prisma migration for all changes.

Rationale:
- better-auth plugins expect specific field/table names. Matching them exactly avoids custom field mapping configuration.

### 5) First admin bootstrapping via database

Decision:
- The first admin is created by:
  1. Register a user through the normal sign-up flow.
  2. Run a SQL command to set `role = 'admin'` on that user.
- Document this in `package/auth/README.md` with the exact SQL command.
- No seed script or CLI tool — keep it simple.

Rationale:
- This is a one-time operation for platform bootstrapping. A SQL command is the simplest, most transparent approach.
- Avoids creating a bootstrapping endpoint that could be a security risk.

Alternatives considered:
- Environment variable for auto-admin email: rejected — security risk if misconfigured.
- Seed script: rejected — adds complexity for a one-time operation.

### 6) JWT payload unchanged

Decision:
- The `definePayload` function in the JWT plugin configuration remains unchanged.
- Auth roles (`owner`/`admin`/`user`) are NOT included in the JWT.
- Downstream services that need to check admin status must call the auth service's admin API.

Rationale:
- Auth roles and server business roles are independent systems. Mixing them in the JWT creates coupling.
- Role changes should take effect immediately, not after JWT expiry.

## Risks / Trade-offs

- [Risk] Schema migration adds columns to the `User` table in production.
  → Mitigation: all new fields have defaults (`role: "user"`, `banned: false`, nullable for reason/expires). Migration is additive and non-breaking.

- [Risk] Organization tables add storage overhead even if organizations aren't used immediately.
  → Mitigation: empty tables have negligible overhead. The plugin is ready when needed.

- [Risk] `sendInvitationEmail` hook needs actual email sending for production.
  → Mitigation: start with a dev-mode logger stub. The auth service already has `nodemailer`/`resend` dependencies that can be wired up.

- [Trade-off] No role in JWT means downstream services can't do role-based routing without calling auth.
  → Acceptable: auth admin operations go through the auth service directly, not through `package/server`.

- [Trade-off] First admin requires manual DB access.
  → Acceptable: one-time bootstrapping operation, documented clearly.

## Migration Plan

1. Add admin and organization plugin imports and configuration to `instance.ts`.
2. Extend `prisma/schema.prisma` with new fields and models.
3. Run `prisma migrate dev` to generate and apply migration.
4. Run `prisma generate` to update the Prisma client.
5. Update `README.md` with bootstrapping instructions.
6. Verify: start auth service, confirm new endpoints respond, create a user, promote to admin via SQL, test admin API calls.

Rollback strategy:
- Revert code changes (remove plugin config, revert schema).
- Run reverse migration to drop new columns/tables.
- No data loss risk since new fields have defaults and new tables start empty.
