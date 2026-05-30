# Change workflow for this repository

Planning is code-first: durable knowledge lives in **code** (types/schemas,
tests, comments), not in a parallel spec corpus.

## Default workflow

1. Plan a change in `plan/proposal/<change>.md` (`/rezics-propose`): context,
   durable constraints/decisions, and a task checklist.
2. Implement with `/rezics-apply`, routing each durable item to its home —
   shape to types/Valibot/Prisma, behavior to a test, the irreducible *why* to a
   concise comment at the owning code, history to the commit message.
3. The plan file is a disposable scaffold; once its work lands and its durable
   content has migrated into code, it can be deleted (git keeps the history).

## Project-specific constraints

- Write all code, comments, and docs in English.
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

- Prefer targeted checks first (affected package build/lint/tests), then broader
  checks (`bun run check:convention`, `bun run check:tokens`, `bun run knip`).
- Do not fix unrelated failures as part of a focused change.

## Documentation expectations

- Update relevant docs when behavior, APIs, or operational steps change.
- For server or schema-impacting changes, include migration and rollout notes in
  the commit message.
