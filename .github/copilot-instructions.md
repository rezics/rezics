# OpenSpec workflow for this repository

Use OpenSpec as the default change-management workflow for non-trivial work.

## Default workflow

1. Propose a change with `/opsx:propose <change-name-or-description>`.
2. Review generated artifacts under `openspec/changes/<change>/`.
3. Implement with `/opsx:apply <change>`.
4. Archive completed changes with `/opsx:archive <change>`.

## Project-specific constraints

- Write all OpenSpec artifacts in English.
- Keep implementation scoped to the packages required by the change.
- Respect monorepo boundaries and shared package contracts:
  - frontend apps: `package/app`, `package/admin`
  - backend: `package/server`
  - shared: `package/api`, `package/contract`, `package/ui`, `package/app-shell`
- Follow feature layering described in `package/app/docs/feature standard.md`:
  - `model` stays pure and must not depend on React/hook/state layers
  - `index.ts` is the public feature entry point
- Prefer minimal, reversible changes over broad refactors unless explicitly requested.

## Validation expectations

- Add or update validation steps in `tasks.md` for each change.
- Prefer targeted checks first (affected package build/lint/tests), then broader checks only if needed.
- Do not fix unrelated failures as part of a focused change.

## Documentation expectations

- Update relevant docs when behavior, APIs, or operational steps change.
- For server or schema-impacting changes, include migration and rollout notes in artifacts.
