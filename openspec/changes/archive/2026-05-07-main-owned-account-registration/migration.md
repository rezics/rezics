## Development-Stage Migration Plan

This change is a breaking development cutover. Do not add dual-read/write
compatibility shims for auth `UserProfile` or auth organization data.

### Auth Database

Reset or migrate the auth database so these product-owned tables are removed:

- `UserProfile`
- `Organization`
- `Member`
- `Invitation`

Temporary unverified auth users may be deleted with the internal cleanup route:

```bash
POST /internal/registration/cleanup-stale
```

Use `x-internal-secret: $AUTH_INTERNAL_TOKEN_GATEWAY_SECRET` and a request body
such as `{ "olderThanHours": 168 }`.

### Main Database

Add the main-owned auth binding columns on `User`:

- `authUserId`
- `email`
- `emailVerifiedAt`
- `emailVerificationSource`

Existing development data can be reset. If data must be kept, backfill
`authUserId = unitId` only for known existing users created before this cutover,
then stop using that fallback in product code.

### Verification

After applying schema changes and regenerating Prisma clients:

1. Confirm auth has no product-facing organization routes.
2. Confirm auth has no `UserProfile` model in the active Prisma schema.
3. Confirm main account setup creates `User` and sets `authUserId`.
4. Confirm `/auth/session/refresh` rejects verified auth-only users until setup.
