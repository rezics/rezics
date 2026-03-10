# Auth Service

`package/auth` is the standalone identity provider for Rezics. It owns user lifecycle, session management, OAuth/OIDC issuance, and now admin + organization management APIs.

## Notifications

Auth notifications are delivered by an auth-owned notification module in `package/auth/src/notification`.

- Email delivery uses SMTP via `nodemailer`.
- Sender precedence is:
  - invitations: `AUTH_INVITATION_FROM_EMAIL`
  - password reset: `AUTH_PASSWORD_RESET_FROM_EMAIL ?? AUTH_INVITATION_FROM_EMAIL`
  - verification/change-email: `AUTH_VERIFICATION_FROM_EMAIL ?? AUTH_INVITATION_FROM_EMAIL`
- Non-production environments log notification payloads instead of sending mail.
- The notification layer is designed to support future non-email channels, including Telegram notifications after account linking or Telegram OAuth support is in place.

## Capabilities

1. Better Auth core identity APIs (`/api/auth/*`)
2. OAuth provider endpoints and JWKS/JWT issuance
3. Admin APIs for user management (`/api/auth/admin/*`)
4. Organization APIs for member and invitation workflows (`/api/auth/organization/*`)

## First Admin Bootstrapping

The first admin is intentionally created via a manual database update.

1. Register a user through normal sign-up flow.
2. Connect to the auth database and run:

```sql
UPDATE "User"
SET "role" = 'admin'
WHERE "email" = 'first-admin@example.com';
```

3. Sign in with that account and call admin endpoints.

## Admin Endpoints

1. `GET /api/auth/admin/list-users`
2. `GET /api/auth/admin/get-user`
3. `POST /api/auth/admin/create-user`
4. `POST /api/auth/admin/update-user`
5. `POST /api/auth/admin/remove-user`
6. `POST /api/auth/admin/set-role`
7. `POST /api/auth/admin/ban-user`
8. `POST /api/auth/admin/unban-user`
9. `POST /api/auth/admin/list-user-sessions`
10. `POST /api/auth/admin/revoke-user-session`
11. `POST /api/auth/admin/revoke-user-sessions`
12. `POST /api/auth/admin/impersonate-user`
13. `POST /api/auth/admin/stop-impersonating`
14. `POST /api/auth/admin/set-user-password`

## Organization Endpoints

1. `POST /api/auth/organization/create`
2. `POST /api/auth/organization/update`
3. `POST /api/auth/organization/delete`
4. `GET /api/auth/organization/get-full-organization`
5. `GET /api/auth/organization/list`
6. `POST /api/auth/organization/invite-member`
7. `POST /api/auth/organization/accept-invitation`
8. `POST /api/auth/organization/reject-invitation`
9. `POST /api/auth/organization/cancel-invitation`
10. `POST /api/auth/organization/remove-member`
11. `POST /api/auth/organization/update-member-role`
12. `POST /api/auth/organization/leave`
13. `POST /api/auth/organization/set-active`
14. `POST /api/auth/organization/has-permission`
