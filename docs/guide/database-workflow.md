# Database Workflow

Rezics database changes are Drizzle-first. The durable source of ordinary schema
shape is the owning package's Drizzle schema, not a hand-written SQL migration.

## Schema Owners

Schema ownership is package-local:

- `@rezics/auth`
- `@rezics/server`
- `@rezics/notify`
- `@rezics/reaction`
- `@rezics/history`
- `@rezics/ranking`

`@rezics/job-runner` is ensure-only because pg-boss owns its internal schema; use
`db:ensure` for it, not Drizzle schema migrations.

Repo database commands run schema owners in this order:

```text
auth -> server -> notify -> reaction -> history -> ranking
```

The tool preflight requires PostgreSQL 18+ with built-in `uuidv7()`.

## Required Migration Flow

For ordinary schema changes:

1. Edit the owning package's Drizzle schema under `package/<owner>/src/db/schema`.
2. Run `bun run db:generate -- --package=<owner>` from the repo root.
3. Review the generated SQL and metadata.
4. Run `bun run db:migrate -- --package=<owner>` for narrow validation.
5. Before handing off broad database work, run `bun run db:reset -- --yes` and
   then `bun run db:migrate` from the repo root.

Use the root commands for multi-owner changes:

```bash
bun run db:generate
bun run db:migrate
bun run db:deploy
bun run db:reset -- --yes
bun run db:ensure
bun run db:smoke
```

Do not use `drizzle push` as the durable repository migration path. It is not a
substitute for checked-in migrations.

## Hand-Written SQL

Do not hand-author ordinary table, column, enum, index, or foreign-key changes
when Drizzle can express the schema.

Hand-written SQL is allowed only for:

- Extensions and helper SQL, such as `ltree` or path helper functions.
- Database features Drizzle cannot express cleanly, such as special GiST/GIN
  indexes, partial indexes, custom operator classes, or ordered capability setup.
- Correcting a documented Drizzle-generated SQL defect while keeping the Drizzle
  schema source in sync.

Custom SQL that provides a prerequisite capability must appear before migrations
that depend on it.

When correcting generated SQL, keep the edit narrow:

1. Identify the Drizzle schema intent.
2. Confirm the generated SQL is invalid or mismatched.
3. Fix only the generated defect.
4. Update the schema source if the schema expression caused the bad output.
5. Validate with reset and migrate.

## Version Pinning

Use the Drizzle v1 rc line intentionally. Pin `drizzle-orm` and `drizzle-kit` to
exact compatible `1.0.0-rc.*` versions where they are declared; do not switch to
broad `latest` or `^` ranges during this migration.

As of 2026-06-04, npm's `rc` dist-tag for both packages resolves to
`1.0.0-rc.3`; newer `rc4` tags are branch prereleases, not the selected exact
pair.

## Known Bugs

### Drizzle Kit 1.0.0-rc.3 Empty Array Default

Observed on 2026-06-06 with `drizzle-kit@1.0.0-rc.3` and
`drizzle-orm@1.0.0-rc.3`.

Drizzle Kit generated invalid PostgreSQL for an empty text-array default when
the schema used an untyped empty array expression:

```ts
textArray().default(sql`ARRAY[]`).notNull()
```

Generated SQL:

```sql
DEFAULT ARRAY::text[]
```

Expected SQL:

```sql
DEFAULT ARRAY[]::text[]
```

Use an explicit typed expression in schema source and migration SQL:

```ts
textArray().default(sql`ARRAY[]::text[]`).notNull()
```

This is a documented generated-SQL defect correction, not permission to design
schema in SQL by hand.

## Reset And Seeding

`db:reset` is destructive and development-only. It drops and recreates selected
local databases, then runs migrations through the same package `db:migrate`
scripts. It must not create application schema itself.

After reset, run the required seed and optional factory workflows explicitly.
Application startup must not be relied on to backfill seed or factory data.

## Migration Review Checklist

- The schema change starts in the owning package's Drizzle schema.
- Generated migrations are checked in under that package's `drizzle/` folder.
- Hand-written SQL is limited to documented custom SQL or generated-SQL defect
  correction.
- Migration SQL and schema source describe the same final shape.
- Fresh reset and repeated migrate both pass.
- Smoke checks either pass or have a documented follow-up issue when the smoke
  tooling itself is stale.
