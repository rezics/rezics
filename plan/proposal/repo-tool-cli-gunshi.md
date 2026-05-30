---
title: Repo Tool CLI With Gunshi
status: done
created: 2026-05-30
completed: 2026-05-30
supersededBy:
tags: [tool, cli, env, seed, prisma, i18n]
---

## Why

Repo tooling currently has two weak boundaries. `tool/env.ts` marks most values
optional, then consumers such as `dev-external-services/services.ts` repeat
defaults with `toolEnv.X ?? ...`. CLI entrypoints also parse raw `argv` by hand
across `tool/dev-external-services`, `package/utils/src/cli`, seed, factory, and
Sequin source repair. That leaves business logic handling strings, unknown flags,
defaults, and validation instead of receiving clean command/config objects.

Move the repo tools to a single Gunshi-backed command tree and a single t3-env
configuration boundary. Raw `argv` and raw `process.env` should be normalized at
the edge; downstream handlers should branch on typed command/config objects. The
same pass should clarify local database bootstrap ownership, rename the managed
reaction database to `rezics_reaction`, and organize i18n scripts under the repo
tool command model.

## Durable constraints & decisions

- `(type)` `tool/env.ts` remains the source of truth for raw tool environment
  shape via `createEnv`; `ToolEnv` is inferred from `typeof toolEnv`.
- `(type)` Any nested or derived `ToolConfig` is produced by a pure mapper from
  `ToolEnv`; `ToolConfig` is inferred from `ReturnType<typeof createToolConfig>`.
  Do not hand-maintain a parallel config interface.
- `(type)` Runtime defaults that belong to repo tools live in the env/config
  boundary, not in command handlers. Handlers must not use `toolEnv.X ?? ...` for
  known tool config.
- `(test)` Missing required env and documented unsafe Sequin example secrets must
  fail before starting or recreating Sequin.
- `(type)` Gunshi command definitions own command names, aliases, option names,
  value types, allowed values, defaults, help text, and unknown-flag behavior.
  Seed/factory/service handlers receive parsed option objects, not raw `argv`.
- `(test)` Unknown or invalid CLI options should be rejected by the CLI layer
  instead of being ignored with warnings.
- `(type)` Command handlers branch on discriminated command intent or direct
  Gunshi command handlers, not on `const [first, ...rest] = argv` in application
  code.
- `(comment)` `@clack/prompts` remains the interactive UI layer only; it is not
  the command/flag parser.
- `(type)` A single repo database registry owns local service database names and
  their package/env associations. The reaction database name is `rezics_reaction`.
- `(test)` Managed local database bootstrap must be idempotent and derive its
  database list from the registry or an artifact generated from that registry,
  not from a second handwritten list.
- `(comment)` Docker Compose lifecycle and Prisma lifecycle are distinct:
  service commands start/stop/inspect dependencies; db/prisma commands create
  databases and run package migrations/generation.
- `(comment)` Fresh managed Docker startup may create empty databases for
  convenience, but Prisma migrations remain the authority for schema contents.
- `(type)` i18n scripts are grouped as repo tool commands under an i18n namespace;
  convention rules stay under `tool/scripts/check-convention` because they are
  repo checks, not i18n maintenance commands.
- `(test)` Existing root/package scripts keep working through compatibility
  shims during the migration, then point at the new tool CLI by explicit path.

## 1. Phase One: Establish Tool Boundaries

- [ ] 1.1 Add Gunshi as the repo/tooling CLI dependency in the appropriate
  workspace manifest and lockfile.
- [ ] 1.2 Create a unified repo tool entrypoint under `tool/` that defines the
  top-level Gunshi command tree and central error/help rendering.
- [ ] 1.3 Refactor `tool/env.ts` so required values, local defaults, and unsafe
  Sequin example values are expressed at the env/config boundary.
- [ ] 1.4 Add a pure `createToolConfig(toolEnv)` mapper and infer `ToolConfig`
  from the mapper return type.
- [ ] 1.5 Update `tool/dev-external-services/services.ts` helpers, or their new
  replacement module, to consume `ToolConfig` instead of raw optional env fields.
- [ ] 1.6 Add focused tests for env/config normalization, required Sequin env,
  unsafe example secret rejection, and absence of consumer-side fallback behavior.
- [ ] 1.7 Create Gunshi service commands for `service up`, `service down`,
  `service logs`, `service ps`, `service health`, `service config plan`,
  `service config apply`, `service source verify`, and `service source repair`.
- [ ] 1.8 Preserve existing root scripts such as `service:up`,
  `service:source:verify`, and `service:config:apply` as explicit shims to the
  new tool CLI.
- [ ] 1.9 Replace hand-written service command parsing in
  `tool/dev-external-services/services.ts` and the compatibility
  `tool/dev-external-services/sequin.ts` path with the unified CLI routing.
- [ ] 1.10 Add CLI tests that assert service commands reject invalid commands,
  invalid options, and unknown flags before reaching service handlers.

## 2. Phase Two: Migrate Seed, DB/Prisma, and i18n Commands

- [ ] 2.1 Define a repo database registry that maps Prisma packages and local
  service databases, including `reaction -> rezics_reaction`.
- [ ] 2.2 Update `tool/dev-external-services/source-postgres/init` bootstrap to
  use the database registry directly or a generated bootstrap artifact.
- [ ] 2.3 Update `.env.example`, compose env wiring, docs, and tests that still
  refer to the managed reaction database as `reaction`.
- [ ] 2.4 Keep package/service names such as `@rezics/reaction` and route names
  unchanged; this phase only renames the local database from `reaction` to
  `rezics_reaction`.
- [ ] 2.5 Move or wrap `tool/db-script/prisma-migrate.ts`,
  `prisma-regenerate.ts`, and `prisma-reset-db.ts` behind Gunshi commands such
  as `tool prisma migrate`, `tool prisma generate`, and `tool prisma reset`.
- [ ] 2.6 Add or update `tool db ensure` so local databases can be created
  idempotently before Prisma migrations, using the registry instead of a
  handwritten SQL list.
- [ ] 2.7 Decide whether `service up` should only print the next recommended
  `tool db ensure` / `tool prisma migrate` commands or offer an explicit
  opt-in flag to run them; keep compose lifecycle and Prisma lifecycle separate.
- [ ] 2.8 Replace `package/utils/src/cli/runner.ts` top-level routing with
  Gunshi-backed seed/factory commands, while keeping seed/factory domain logic
  in package modules until there is a stronger reason to move it.
- [ ] 2.9 Replace `parseSeedArgs`, `parseFactoryArgs`, and direct `argv.find`
  default dispatch with Gunshi option schemas and typed handler options.
- [ ] 2.10 Preserve existing scripts such as `bun run seed`,
  `bun run factory`, `@rezics/server seed:factory:fast`, and
  `@rezics/server seed:init-meili-search` through explicit script rewrites or
  shims.
- [ ] 2.11 Update seed/factory CLI tests from parser-unit tests to command
  schema/handler option tests, including repeated scenario options and
  comma-separated scenario compatibility if retained.
- [ ] 2.12 Move i18n maintenance scripts into a coherent i18n command namespace
  under the repo tool CLI, for example `tool i18n check`,
  `tool i18n missing`, `tool i18n dedup`, and `tool i18n analyze-duplicates`.
- [ ] 2.13 Keep `tool/scripts/check-convention/**` in place and only update
  convention script wiring where needed; do not merge convention rules into
  i18n maintenance commands.
- [ ] 2.14 Update root `package.json`, `tool/package.json`, and docs so public
  commands point at the new CLI while old direct file invocations either remain
  as temporary compatibility shims or are removed in the same clear cutover.
- [ ] 2.15 Run focused CLI/env tests, relevant seed/factory tests, and
  `bun run check:convention`; update any brittle tests that depended on the old
  handwritten parser behavior.

## Out of scope

- Reworking production deployment, Kamal configuration, or production database
  topology.
- Renaming the `@rezics/reaction` package, service name, HTTP routes, or domain
  terminology.
- Changing Prisma schema contents beyond what is necessary for local database
  naming and tool orchestration.
- Replacing `@clack/prompts` for interactive selection and confirmation UI.
- Building a long-lived spec corpus or validation CLI separate from the code and
  tests.
