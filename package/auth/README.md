# @rezics/auth

Standalone authentication and identity service for the Rezics platform. Handles user lifecycle, session management, OAuth/OIDC, organization management, and admin APIs.

## Overview

An Elysia-based backend service that serves as the identity provider for the platform. Built on [Better Auth](https://www.better-auth.com) with Prisma for database access, it provides standard auth flows plus admin and organization management endpoints.

## Capabilities

- **Core Identity** — Sign-up, sign-in, password reset, email verification via Better Auth
- **OAuth/OIDC** — OAuth provider endpoints and JWKS/JWT issuance
- **Admin APIs** — User management, session control, role assignment, impersonation
- **Organization APIs** — CRUD, member management, invitations, role-based permissions
- **Notifications** — Email delivery via SMTP (nodemailer); extensible for future channels

## API Endpoints

### Core Auth

All Better Auth standard routes under `/api/auth/*`.

### Admin (`/api/auth/admin/*`)

| Method | Endpoint                  | Description              |
| ------ | ------------------------- | ------------------------ |
| GET    | `/list-users`             | List all users           |
| GET    | `/get-user`               | Get user details         |
| POST   | `/create-user`            | Create a new user        |
| POST   | `/update-user`            | Update user profile      |
| POST   | `/remove-user`            | Delete a user            |
| POST   | `/set-role`               | Assign user role         |
| POST   | `/ban-user`               | Ban a user               |
| POST   | `/unban-user`             | Unban a user             |
| POST   | `/list-user-sessions`     | List sessions for a user |
| POST   | `/revoke-user-session`    | Revoke a single session  |
| POST   | `/revoke-user-sessions`   | Revoke all sessions      |
| POST   | `/impersonate-user`       | Impersonate a user       |
| POST   | `/stop-impersonating`     | Stop impersonation       |
| POST   | `/set-user-password`      | Reset user password      |

### Organization (`/api/auth/organization/*`)

| Method | Endpoint                  | Description                |
| ------ | ------------------------- | -------------------------- |
| POST   | `/create`                 | Create organization        |
| POST   | `/update`                 | Update organization        |
| POST   | `/delete`                 | Delete organization        |
| GET    | `/get-full-organization`  | Get organization details   |
| GET    | `/list`                   | List organizations         |
| POST   | `/invite-member`          | Send invitation            |
| POST   | `/accept-invitation`      | Accept invitation          |
| POST   | `/reject-invitation`      | Reject invitation          |
| POST   | `/cancel-invitation`      | Cancel invitation          |
| POST   | `/remove-member`          | Remove member              |
| POST   | `/update-member-role`     | Update member role         |
| POST   | `/leave`                  | Leave organization         |
| POST   | `/set-active`             | Set active organization    |
| POST   | `/has-permission`         | Check permission           |

## JWT and JWKS

JWT service metadata is persisted in the auth database. Environment variables (`AUTH_JWT_*`) serve as bootstrap inputs only.

| Endpoint                   | Description                       |
| -------------------------- | --------------------------------- |
| `/api/auth/session/jwks`   | Canonical auth JWKS               |
| `/.well-known/jwks.json`   | Compatibility JWKS                |

- Session/browser routes use credentialed CORS
- Public JWKS and discovery routes use non-credentialed CORS

## Notifications

Email delivery is configured per notification type:

| Type               | Environment Variable                                       |
| ------------------ | ---------------------------------------------------------- |
| Invitations        | `AUTH_INVITATION_FROM_EMAIL`                               |
| Password reset     | `AUTH_PASSWORD_RESET_FROM_EMAIL` (falls back to invitation)|
| Verification       | `AUTH_VERIFICATION_FROM_EMAIL` (falls back to invitation)  |

Non-production environments log payloads instead of sending mail.

## First Admin Setup

The first admin is bootstrapped manually:

1. Register a user through the normal sign-up flow
2. Update the role in the auth database:
   ```sql
   UPDATE "User" SET "role" = 'admin' WHERE "email" = 'admin@example.com';
   ```
3. Sign in and access admin endpoints

## Scripts

```bash
bun run dev              # Start with --watch
bun run build            # Compile to standalone binary
bun run prisma:generate  # Generate Prisma client
bun run prisma:migrate   # Run migrations + generate
bun run prisma:studio    # Open Prisma Studio
```

## Tech Stack

- [Elysia](https://elysiajs.com) HTTP framework
- [Better Auth](https://www.better-auth.com) for identity management
- [Prisma 7](https://www.prisma.io) with PostgreSQL
- [Jose](https://github.com/panva/jose) for JWT/JWKS operations
- [Nodemailer](https://nodemailer.com) for email delivery
