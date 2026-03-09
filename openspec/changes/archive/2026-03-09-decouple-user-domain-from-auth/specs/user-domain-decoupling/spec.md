## ADDED Requirements

### Requirement: Server user module contains no identity lifecycle operations

The `package/server` user module SHALL NOT contain any code that issues, refreshes, or validates authentication credentials. All identity lifecycle operations (registration, login, logout, password management, email verification, session management) SHALL be handled exclusively by `package/auth`.

#### Scenario: Auth routes removed from server

- GIVEN the server is running with the refactored user module
- WHEN a client sends `POST /users/register`, `POST /users/login`, `POST /users/refresh-token`, `POST /users/change-password`, `POST /users/reset-password`, `POST /users/send-verification-code`, or `POST /users/verify-verification-code`
- THEN the server SHALL respond with `404 Not Found` (route does not exist)

#### Scenario: UserService has no auth methods

- GIVEN the `UserService` class in `user.service.ts`
- WHEN inspecting its public API
- THEN it SHALL NOT expose `authenticate()`, `verifyPassword()`, `resetPassword()`, `sendVerificationCode()`, `verifyVerificationCode()`, or `resendVerificationCode()` methods

#### Scenario: No HMAC JWT plugins in server

- GIVEN the server's `coreInstance()` function in `core.ts`
- WHEN inspecting its plugin chain
- THEN it SHALL NOT include any `@elysiajs/jwt` plugin registrations
- AND the Elysia context SHALL NOT include `jwt`, `refreshToken`, or `cookie.refresh_token` properties

### Requirement: Server authenticates requests exclusively via JWKS verification

All authenticated server endpoints SHALL validate incoming JWTs using the `verifyBearerToken()` function from `@package/auth/jwt`, which performs ES256 JWKS-based verification against the auth service's published key set.

#### Scenario: Valid auth-issued JWT accepted

- GIVEN a JWT issued by `package/auth` with `alg: ES256`, valid `kid`, `iss`, `aud: rezics-api`, `scope: user`, and unexpired `exp`
- WHEN the JWT is sent in the `Authorization: Bearer <token>` header to any protected endpoint
- THEN the server SHALL accept the request and extract `unitId` and `slug` from the JWT payload

#### Scenario: Expired JWT rejected

- GIVEN a JWT issued by `package/auth` that has expired
- WHEN the JWT is sent to a protected endpoint
- THEN the server SHALL respond with `401 Unauthorized`

#### Scenario: HMAC-signed JWT rejected

- GIVEN a JWT signed with HMAC (HS256) using the old server secret
- WHEN the JWT is sent to a protected endpoint
- THEN the server SHALL respond with `401 Unauthorized` because `alg !== ES256`

### Requirement: Server Prisma schema contains no auth-owned models

The `package/server` Prisma schema SHALL NOT contain models or fields that duplicate data owned by `package/auth`.

#### Scenario: Auth models removed

- GIVEN the `package/server/prisma/schema.prisma` file
- WHEN inspecting the schema
- THEN it SHALL NOT contain `AuthSession` or `VerificationCode` models
- AND the `User` model SHALL NOT contain a `passwordHash` field

### Requirement: Server has no auth-related dependencies

`package/server/package.json` SHALL NOT list `@elysiajs/jwt`, `@elysiajs/bearer`, `bcrypt`, `@types/bcrypt`, `nodemailer`, or `@types/nodemailer` as dependencies.

#### Scenario: Clean dependency list

- GIVEN `package/server/package.json`
- WHEN inspecting `dependencies` and `devDependencies`
- THEN none of the auth-related packages SHALL be present

## REMOVED Requirements

### Requirement: Server-local JWT issuance

- **Reason**: JWT issuance is now exclusively handled by `package/auth` via better-auth's JWT plugin with ES256 JWKS signing.
- **Migration**: All clients must authenticate via `package/auth` endpoints (`/api/auth/sign-in/email`, `/api/auth/sign-up/email`). No server endpoint issues JWTs.

### Requirement: Server-managed refresh token sessions

- **Reason**: Session management is now exclusively handled by `package/auth` via better-auth's `Session` model. The server's `AuthSession` model and `user.session.service.ts` are redundant.
- **Migration**: Token refresh flows must target the auth service's `/api/auth/token` endpoint. The server `AuthSession` table is dropped.

### Requirement: Server-managed email verification codes

- **Reason**: Email verification is now exclusively handled by `package/auth` via better-auth's `Verification` model.
- **Migration**: The server's `VerificationCode` table is dropped. Verification flows must target auth service endpoints.

### Requirement: Server-side password hashing and verification

- **Reason**: Credential storage and verification are exclusively owned by `package/auth` via better-auth's `Account` model.
- **Migration**: The `passwordHash` column is dropped from the server `User` table. `hashPassword()` and `verifyPassword()` utilities are removed from `utils.ts`.
