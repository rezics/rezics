# @rezics/server

Core backend API server for the Rezics platform. Serves books, chapters, reviews, readlists, user interactions, file uploads, and content management.

## Overview

An Elysia-based API server that provides the main business logic for the platform. Uses Prisma with PostgreSQL for data persistence and integrates with `@rezics/auth` for identity, `@rezics/jwt` for token verification, and `@rezics/search` for full-text search.

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
bun run dev              # Start with --watch (development)
bun run build            # Compile to standalone binary
bun run prisma:generate  # Generate Prisma client
bun run prisma:migrate   # Run migrations + generate
bun run prisma:deploy    # Deploy migrations (production)
bun run prisma:studio    # Open Prisma Studio
bun run seed:mock        # Seed mock data
bun run db:migrate       # Run custom migrations
```

## Mock Seed

`bun run seed:mock` resets the server DB and populates it with deterministic mock data. All counts are env-configurable.

```bash
bun run seed:mock                                       # default profile
SEED_PROFILE=fast bun run seed:mock                     # small fixture, quick iteration
SEED_PROFILE=fast SEED_BOOKS=200 bun run seed:mock      # profile + per-knob override
SEED_CHAPTER_UNIT_PROBABILITY=0 bun run seed:mock       # tree-only chapters (no CHAPTER Units)
```

### Knobs

| Env variable                       | Default | Fast | Controls                                    |
| ---------------------------------- | ------- | ---- | ------------------------------------------- |
| `SEED_PROFILE`                     | —       | —    | `default` or `fast`                         |
| `SEED_USERS`                       | 200     | 30   | total users                                 |
| `SEED_TAGS`                        | 400     | 50   | total tags                                  |
| `SEED_BOOKS` / `_GAMES` / `_MEDIA` | 1000    | 50   | works per kind                              |
| `SEED_SHELVES`                     | 500     | 30   | random user shelves                         |
| `SEED_REALMS` / `_ZONES`           | 20 / 40 | same | realms / zones                              |
| `SEED_PERSON_ENTITIES`             | 800     | same | person attribution entities                 |
| `SEED_ORGANIZATION_ENTITIES`       | 200     | same | organization attribution entities           |
| `SEED_FOLLOWS_PER_USER`            | 5       | same | per-user follow picks                       |
| `SEED_FAVORITE_ITEMS_PER_USER`     | 8       | same | items in each user's Favorites shelf        |
| `SEED_REVIEWS_PER_WORK_MAX`        | 50      | 5    | power-law upper bound for reviews / work    |
| `SEED_EXCERPTS_PER_WORK_MAX`       | 15      | 3    | power-law upper bound for excerpts / work   |
| `SEED_REMARKS_PER_WORK_MAX`        | 10      | 3    | power-law upper bound for remarks / work    |
| `SEED_TREE_POSTS_PER_WORK_MAX`     | 120     | 10   | power-law upper bound for thread posts      |
| `SEED_CHAPTERS_PER_BOOK_MIN`       | 5       | 3    | chapter tree lower bound per book           |
| `SEED_CHAPTERS_PER_BOOK_MAX`       | 1200    | 30   | chapter tree upper bound per book           |
| `SEED_CHAPTER_UNIT_PROBABILITY`    | 0.1     | 0.1  | chance a chapter node is materialized as a Unit (rest live only in BookIndex tree JSON) |

Per-knob env vars always override the profile. Config source: `prisma/seed/mocks/config.ts`.

## Tech Stack

- [Elysia](https://elysiajs.com) HTTP framework with OpenAPI support
- [Prisma 7](https://www.prisma.io) with PostgreSQL
- [AWS S3](https://aws.amazon.com/s3/) for file storage
- [Jose](https://github.com/panva/jose) for JWT operations
- Compiles to a standalone Bun binary for deployment
