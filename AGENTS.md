# AGENTS.md

Shared project instructions for coding agents. Keep this file short, concrete,
and repo-specific; move detailed rules to skills or docs.

## Project

Rezics (repo `rezics/rezics`) is a full-stack TypeScript monorepo for a
community-driven, cross-language catalog of works. Everything — books, games,
media, posts, shelves, tags, community `realm`s — is modeled as a unified
`Unit`, so the same catalog, classification, attribution, and social layers work
across content types and languages. Communities (`realm`s) collectively classify
and discuss works, co-locating a work's index, discussion, and collaborative
knowledge. Runtime and package manager: Bun. Workspaces live under `package/*`.

## Commands

The command surface is [go-task](https://taskfile.dev). Every workspace under
`package/*` owns a `Taskfile.yml`; the root `Taskfile.yml` aggregates them via
`includes`, so package tasks are namespaced (`task server:dev`, `task
app:build`). `bun` stays under the hood only — runtime (it executes the `tool/`
CLI), package manager (`bun install`), and bundler (`bun build`). Run `task` to
list everything.

```bash
task                     # list every task (task --list)
task dev                 # start all dev processes (zellij)
task devenv:up           # start all dev processes (devenv process-compose)
task app:dev             # frontend app, Vite
task server:dev          # main Elysia API
task auth:dev            # auth service

task test                # all tests (bun test)
task format              # Biome format
task format:check        # Biome format check
task check:convention    # repo conventions
task check:tokens        # token checks
task knip                # unused exports/deps

task db:generate         # generate migrations (all schema units)
task db:migrate          # apply migrations (all schema units)
task seed:factory        # synthetic data — realistic preset
task seed:factory:fast   # synthetic data — fast preset

task storybook           # all Storybooks
task ui:storybook        # UI Storybook, port 6007
```

## Architecture Rules

- Backend domains use `{domain}.api.ts`, `.service.ts`, `.mapper.ts`, `.types.ts`.
  Mount domain APIs from `package/server/src/index.ts`.
- API types are contract-first in `@rezics/contract`; frontend access belongs in
  `@rezics/api`. Do not duplicate API DTOs in app code.
- `@rezics/server` and `@rezics/auth` use separate Drizzle schemas and databases.
- `package/app` features follow the layered structure in
  `package/app/docs/feature standard.md`. `models/` must not import React,
  hooks, or state modules; external consumers go through the feature `index.ts`.
- Runtime env validation uses `@t3-oss/env-core` + Valibot. Keep env dependencies
  isolated from module exports.

## Workflows

- Planning is code-first: capture context, durable constraints, and a task
  checklist in `plan/proposal/<change>.md` via `/rezics-propose`, then implement
  with `/rezics-apply`, routing each durable item into code (types/tests/comments)
  and letting the plan file become disposable. No spec corpus.
- In this development-stage project, internal renames are clear cutovers: update
  all internal callsites in the same change unless a plan explicitly says
  otherwise.
- Main branch is `main`. See `CONTRIBUTING.md` for the mainline/archive Git
  workflow.
- Database migrations are Drizzle-first. See
  `docs/guide/database-workflow.md`; do not hand-author ordinary schema
  migrations. Edit migration SQL only for custom SQL or documented
  Drizzle-generated SQL defects while keeping schema source in sync.
- Dirty working trees are normal. The maintainer may be editing in parallel, so
ignore unrelated unstaged/untracked changes and never revert, stash, clean, or
flag them.
- Stage only task-owned files by explicit path; never use `git add -A` or
`git add .`.
- Commit only when the index contains this task’s staged files. If unrelated staged files are staged, retry briefly; if still blocked, report them and stop.

## UI Work

- Load the `rezics-design` skill before editing or reviewing JSX, CSS, UnoCSS
  classes, tokens, typography, spacing, component selection, icons, or copy.
- Frontend user-facing product copy must go through `@rezics/i18n`; do not
  hard-code display strings in React components. Add or reuse locale keys under
  `package/i18n/locales/` and validate with `task check:i18n`.
- Authoritative UI rules live in `rezics-design`, the `@rezics/ui` Storybook, and
  the `check:convention` / `check:tokens` rules; do not duplicate those details
  here.
- For browser verification, prefer giving the user the exact URLs to verify
  after they run `task dev` from the repo root. Do not download browsers or
  run heavyweight browser automation unless the user explicitly asks.

## References

- `CONTRIBUTING.md` - route, folder, seed, Storybook, and convention details.
- Authoritative behavior lives in code: types/schemas, tests, and the
  `check:convention` rules. `plan/` holds in-flight planning.
- `.agents/skills/` and `.claude/skills/` - task-specific agent guidance.
