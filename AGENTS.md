# AGENTS.md

Shared project instructions for coding agents. Keep this file short, concrete,
and repo-specific; move detailed rules to skills, OpenSpec specs, or docs.

## Project

Library.Book (`rezics-book-library`) is a full-stack TypeScript monorepo for a
book library platform. Runtime and package manager: Bun. Workspaces live under
`package/*`.

## Commands

```bash
bun run dev                         # start the local dev orchestration
bun --filter=@rezics/app run dev    # frontend app, Vite
bun --filter=@rezics/server run dev # main Elysia API
bun --filter=@rezics/auth run dev   # auth service

bun test                            # tests in the current package
bun run format                      # Biome format
bun run format:check                # Biome format check
bun run check:convention            # repo conventions
bun run check:tokens                # token checks
bun run knip                        # unused exports/deps

bun --filter=@rezics/server run prisma:generate
bun --filter=@rezics/server run prisma:migrate
bun --filter=@rezics/server run seed:factory
bun --filter=@rezics/server run seed:factory:fast

bun run storybook                   # all Storybooks
bun --filter=@rezics/ui run storybook # UI Storybook, port 6007
```

## Architecture Rules

- Backend domains use `{domain}.api.ts`, `.service.ts`, `.mapper.ts`, `.types.ts`.
  Mount domain APIs from `package/server/src/index.ts`.
- API types are contract-first in `@rezics/contract`; frontend access belongs in
  `@rezics/api`. Do not duplicate API DTOs in app code.
- `@rezics/server` and `@rezics/auth` use separate Prisma schemas and databases.
- `package/app` features follow the layered structure in
  `package/app/docs/feature standard.md`. `models/` must not import React,
  hooks, or state modules; external consumers go through the feature `index.ts`.
- Runtime env validation uses `@t3-oss/env-core` + Valibot. Keep env dependencies
  isolated from module exports.

## Workflows

- Non-trivial changes use OpenSpec: propose, review artifacts under
  `openspec/changes/<change>/`, apply, then archive when complete.
- In this development-stage project, internal renames are clear cutovers: update
  all internal callsites in the same change unless an OpenSpec explicitly says
  otherwise.
- Main branch is `dev`.

## UI Work

- Load the `rezics-design` skill before editing or reviewing JSX, CSS, UnoCSS
  classes, tokens, typography, spacing, component selection, icons, or copy.
- Authoritative UI rules live in `rezics-design`, `@rezics/ui` Storybook, and
  `openspec/specs/ui-component-foundation/spec.md`; do not duplicate those
  details here.

## References

- `CONTRIBUTING.md` - route, folder, seed, Storybook, and convention details.
- `openspec/specs/` - authoritative behavior specs.
- `.agents/skills/` and `.claude/skills/` - task-specific agent guidance.
