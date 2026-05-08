## ADDED Requirements

### Requirement: Two-phase user seeding (auth then main)

The user seed pipeline SHALL execute in two strict phases. Phase 1 (`seedAllAuthUsers`) SHALL create every seed user in the auth database and capture a deterministic `{ email, authUserId, name, slug }` result map. Phase 2 (`seedAllMainUsers`) SHALL consume that map to create or upsert the corresponding main `User` rows, with `userId === authUserId` and `authUserId` set on the main row. Phase 2 SHALL NOT begin before phase 1 completes successfully. The pipeline SHALL NOT interleave auth and main writes per user.

#### Scenario: Auth phase completes before main phase

- **WHEN** the seed CLI runs the user pipeline
- **THEN** every auth user is created (phase 1) before any main user is touched (phase 2)
- **AND** phase 2 receives a populated email→authUserId map produced by phase 1

#### Scenario: Phase 1 failure leaves no main users half-written

- **WHEN** phase 1 fails part-way (e.g., a transient auth DB error)
- **THEN** phase 2 SHALL NOT execute
- **AND** the pipeline reports the phase 1 failure with no orphan main rows attributed to the failed batch

#### Scenario: Idempotent re-run on partial completion

- **WHEN** phase 1 succeeded but phase 2 was interrupted, and the CLI is re-run
- **THEN** phase 1 SHALL upsert by email (no duplicate auth users)
- **AND** phase 2 SHALL upsert by `userId` (no duplicate main users)
- **AND** the pipeline reaches a clean fully-seeded state

### Requirement: Factory mock users cross-seed auth

The factory mock user seeder (`package/server/prisma/factory/users.ts`) SHALL create an auth `User` for every mock user it produces, using the same `seedAuthUser` helper as the cross-seed pipeline. Each mock user's main row SHALL be created with `userId === authResult.userId` and `authUserId === authResult.userId`. Mock users SHALL be capable of completing a full sign-in round-trip after seeding.

#### Scenario: Mock user has corresponding auth row

- **WHEN** the factory seed creates a mock user
- **THEN** an auth `User` row SHALL exist with the mock user's email
- **AND** the main `User.userId` SHALL equal that auth `User.id`

#### Scenario: Mock user can sign in

- **WHEN** the factory seed completes
- **THEN** any seeded mock user SHALL be able to authenticate against the auth service using the seed-assigned credentials
- **AND** the cookie-boundary refresh SHALL issue a `rezics-session-token` for the user (assuming `slug !== null`)

#### Scenario: SeedCtx carries authPrisma

- **WHEN** the factory orchestrator dispatches the user seeding step
- **THEN** the `SeedCtx` passed to the strategy SHALL include an `authPrisma` client
- **AND** `seedUsers(ctx, spec)` SHALL call `seedAuthUser(ctx.authPrisma, ...)` before writing to the main DB

### Requirement: Reset clears both databases

`resetDatabase` (the seed CLI's reset action) SHALL truncate or drop-and-recreate user-related state in both the auth database and the server database, so that a `--reset` followed by `--seed` produces a clean, internally consistent two-database state. The current implementation that resets only the server DB SHALL be extended to cover the auth DB.

#### Scenario: Reset clears auth users

- **WHEN** the seed CLI is invoked with reset
- **THEN** auth `User`, `Session`, `Account`, and verification rows for seed users SHALL be cleared
- **AND** main `User` rows SHALL also be cleared

#### Scenario: Reset preserves non-user infra

- **WHEN** the reset runs
- **THEN** infra-only rows that survive non-user resets (e.g., default realm, content-type tags) MAY be preserved according to the existing `database-reset-preserve` capability
- **AND** the reset SHALL NOT drop the underlying schema unless explicitly requested

### Requirement: Seed users do not write accountStatus

Seed and factory writers SHALL NOT supply an `accountStatus` field on `prisma.user.create` or `prisma.user.upsert`. The `User.accountStatus` column has been removed; readiness is conveyed by `slug !== null`. Seeded users that should be member-ready SHALL be written with their canonical slug; setup-stage seed users (if any) SHALL be written with `slug: null`.

#### Scenario: Member-ready seed user has slug

- **WHEN** a seed function creates a member-ready user (e.g., root, admin, regular)
- **THEN** the create payload SHALL include the canonical `slug`
- **AND** it SHALL NOT include any `accountStatus` field

#### Scenario: TypeScript blocks accidental accountStatus writes

- **WHEN** a developer attempts to write `accountStatus: "MEMBER_READY"` in a seed function
- **THEN** TypeScript SHALL surface a type error (the field does not exist on the Prisma user model after migration)
