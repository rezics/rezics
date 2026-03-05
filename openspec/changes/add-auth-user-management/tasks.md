## 1. Access Control Definition

- [x] 1.1 Create `src/auth/permissions.ts` in `package/auth` defining the `ac` (access control) instance with resource permissions: `user` (list, get, create, update, delete, ban, set-role, impersonate), `organization` (create, update, delete), `member` (invite, remove, update-role), `invitation` (cancel)
- [x] 1.2 Define role-to-permission mappings in `src/auth/permissions.ts`: `owner` (all permissions), `admin` (all except impersonate-admins), `user` (organization:create only)

## 2. Plugin Integration

- [x] 2.1 Import `admin` and `organization` from `better-auth/plugins` in `src/auth/instance.ts`
- [x] 2.2 Import the `ac` instance and role definitions from `src/auth/permissions.ts`
- [x] 2.3 Add `admin()` plugin to the plugins array with `ac`, `roles`, and `defaultRole: "user"` configuration
- [x] 2.4 Add `organization()` plugin to the plugins array with `sendInvitationEmail` hook (log in dev, email in prod) and organization-level role definitions (`owner`, `admin`, `member`)

## 3. Prisma Schema Extension

- [x] 3.1 Add `role` (String, default `"user"`), `banned` (Boolean, default `false`), `banReason` (String?), `banExpires` (DateTime?) fields to the `User` model in `prisma/schema.prisma`
- [x] 3.2 Add `Organization` model with fields: `id` (UUIDv7), `name`, `slug` (unique), `logo` (nullable), `metadata` (nullable), `createdAt`
- [x] 3.3 Add `Member` model with fields: `id` (UUIDv7), `organizationId`, `userId`, `role`, `createdAt`, and foreign keys to `Organization` and `User`
- [x] 3.4 Add `Invitation` model with fields: `id` (UUIDv7), `organizationId`, `email`, `role`, `status`, `expiresAt`, `inviterId`, `createdAt`, and foreign key to `Organization`

## 4. Database Migration

- [x] 4.1 Run `bunx prisma migrate dev --name add-admin-and-organization` to generate migration
- [x] 4.2 Run `bun run prisma:generate` to update the Prisma client
- [x] 4.3 Verify migration applies cleanly on a fresh database and on a database with existing user records (existing users should get `role: "user"` and `banned: false`)

## 5. Documentation

- [x] 5.1 Update `package/auth/README.md` with: service overview, first-admin bootstrapping instructions (register → SQL update `role`), and list of available admin/organization endpoints

## 6. Validation

- [x] 6.1 Start the auth service (`bun run dev` in `package/auth`) and verify it boots without errors
- [ ] 6.2 Verify admin endpoints respond (e.g., `GET /api/auth/admin/list-users` returns 403 for unauthenticated requests)
- [ ] 6.3 Register a test user, promote to admin via SQL, and verify admin API calls succeed (list users, ban/unban, set role)
- [ ] 6.4 Verify organization endpoints respond (create organization, invite member, list organizations)
- [x] 6.5 Run `bunx tsc --noEmit` in `package/auth` to confirm no type errors
