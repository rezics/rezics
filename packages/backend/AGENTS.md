# Backend AGENTS.md

## Code Style

- **No `as` type assertions** unless the type system genuinely cannot express the constraint.
- **Prefer Drizzle Queries API** (`db.query.*`) over query builder (`db.select().from()...`).
- **No conditional spread** — use `key: x ?? undefined` instead of `...(x ? { key: x } : {})`.
- **Yieldable errors need no `Effect.fail` wrapper** — `yield* new XxxError()` directly.
- **`database` is always spelled out**, never abbreviated to `db`.
- **`index.ts` may contain implementation code**, not just re-exports.
- **No `switch/case`** — use Effect `Match` for all value-based branching.
- **Boolean variables** must use `is`/`has`/`should`/`can` prefixes.
- **No `let`** — all bindings are `const`.
- **Prefer `export * from "..."`** in barrel files.

## Architecture

- All constants go in the **Config service** (`services/config/index.ts`).
- **No `Effect.die` / `Effect.orDie`** — map to `HttpApiError.InternalServerError`.
- **Error mapping must use individual `Effect.catchTag`** calls — no batch `Effect.mapError`.
- API groups live in `interfaces/` (contract) and `implementations/` (handlers) with 1:1 correspondence.
- Rich text content is **Portable Text** JSON — see `libraries/portable-text.ts` for Effect Schema.
- Search uses **Meilisearch** wrapped as an Effect service.
