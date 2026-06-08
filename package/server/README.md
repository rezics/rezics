# @rezics/server

Core backend API server for the Rezics platform. Serves books, chapters, reviews, readlists, user interactions, file uploads, and content management.

## Overview

An Elysia-based API server that provides the main business logic for the platform. Uses Drizzle with PostgreSQL for data persistence and integrates with `@rezics/auth` for identity, `@rezics/jwt` for token verification, and `@rezics/search` for full-text search.

## API Domains

| Domain      | Description                               |
| ----------- | ----------------------------------------- |
| `book`      | Book CRUD, metadata, and discovery        |
| `chapter`   | Chapter content management                |
| `comment`   | User comments on content                  |
| `reaction`  | Content reactions                         |
| `feedback`  | User feedback submissions                 |
| `readlist`  | Reading list collections                  |
| `review`    | Book reviews and ratings                  |
| `user`      | User profiles                             |
| `token`     | Token issuance and management             |
| `tag`       | Content tagging                           |
| `unit`      | Content units                             |
| `upload`    | File uploads (S3)                         |
| `meili`     | Meilisearch synchronization               |
| `stats`     | Admin analytics                           |
| `session`   | JWT session management and JWKS           |

Each domain follows the pattern: `{domain}.api.ts` (routes), `{domain}.service.ts` (logic), `{domain}.mapper.ts` (transforms), `{domain}.types.ts` (types).

## JWT and Session

The server stores JWT service metadata in its own database for both the local issuer and trusted upstream issuers.

| Endpoint              | Description                    |
| --------------------- | ------------------------------ |
| `/api/session/jwks`   | Canonical server JWKS          |
| `/api/session/token`  | Session token issuance         |

Environment variables (`AUTH_JWKS_URL`, `AUTH_JWT_ISSUER`, `MAIN_SESSION_JWT_*`) are bootstrap inputs; the local JWT service registry is the steady-state source of truth.

## Scripts

```bash
task server:dev              # Start with --watch (development)
task server:build            # Compile to standalone binary
task server:db:generate      # Generate Drizzle migrations
task server:db:migrate       # Run local Drizzle migrations
task server:db:deploy        # Deploy Drizzle migrations (production)
task server:db:studio        # Open Drizzle Studio
task seed:factory            # Seed factory data
```

## Factory Seed

Factory seed commands seed baseline rows without resetting databases, run a base preset, optionally run special scenarios, and print special scenario fixture Unit IDs. Run `task seed:database-reset` explicitly when a clean database is needed; headless reset requires `task seed:database-reset -- --yes`.

```bash
task seed:factory:fast
task factory -- --preset=fast --no-interactive --scenario=complex-shelf --manifest=both
bun run ../../package/utils/bin/cli.ts factory --preset=fast --no-interactive --all-scenarios --meili=skip
```

Special target output includes `label`, `scenario`, `unitType`, `unitId`, and optional `notes`. Use `--manifest=human`, `--manifest=json`, `--manifest=both`, or `--manifest=none`.

Meilisearch modes:

- `--meili=skip` skips index initialization and synchronization.
- `--meili=init-and-sync` initializes indexes before seeding and synchronizes seeded Units through seed runtime hooks.

Factory Meilisearch synchronization is intentionally direct through
`@rezics/search`. It is setup-time data projection, not runtime mutation
propagation, so factory commands do not require `JOB_RUNNER_BASE_URL`,
`JOB_DATABASE_URL`, Sequin, or a job-runner worker.

Special scenarios are `large-post-tree`, `large-content-tree`, `large-history`, and `complex-shelf`. Non-interactive runs are base-only unless `--scenario=<name>` or `--all-scenarios` is passed.

## Tech Stack

- [Elysia](https://elysiajs.com) HTTP framework with OpenAPI support
- [Drizzle ORM](https://orm.drizzle.team) with PostgreSQL
- [AWS S3](https://aws.amazon.com/s3/) for file storage
- [Jose](https://github.com/panva/jose) for JWT operations
- Compiles to a standalone Bun binary for deployment
