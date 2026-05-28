# slug-ref Specification

## Purpose

Defines the `SlugRef` Typebox schema exported by
`@rezics/contract`: `{ scope, slug, unitId? }` where `scope` is
either a named bucket (`user`, `realm`, `tag`, `zone`, `entity`)
or an owner Unit id used for sub-resources like a user's shelves.
Owns the backend resolution strategy that prefers the embedded
`unitId` and otherwise looks up `(slugScope, slug)` against
`Unit`, with non-existent slugs dropped from filters rather than
failing the request.

## Requirements

### Requirement: SlugRef type in contract

The `@rezics/contract` package SHALL export a `SlugRef` Typebox schema representing a unit reference by slug, with an explicit `scope` and an optional `unitId` for zero-cost resolution. The type SHALL be:

```typescript
type SlugScopeName = 'user' | 'realm' | 'tag' | 'zone' | 'entity'

type SlugRef = {
  scope: SlugScopeName | string  // Named scope OR an owner Unit id (UUID string)
  slug: string                    // Required — the human-readable slug
  unitId?: string                 // Optional — the resolved UUID for zero-cost lookup
}
```

The `scope` field is REQUIRED. When `scope` matches one of the five named values (`'user' | 'realm' | 'tag' | 'zone' | 'entity'`), it identifies a top-level scope. Any other string value SHALL be interpreted as an owner Unit id, used for owner-scoped sub-resources such as shelves under a user.

#### Scenario: SlugRef with named scope, slug, and unitId

- **WHEN** a `SlugRef` value `{ scope: 'tag', slug: "light-novel", unitId: "uuid-123" }` is provided
- **THEN** it SHALL pass schema validation

#### Scenario: SlugRef with named scope and slug only

- **WHEN** a `SlugRef` value `{ scope: 'user', slug: "alice" }` is provided
- **THEN** it SHALL pass schema validation

#### Scenario: SlugRef with owner-unit-id scope

- **WHEN** a `SlugRef` value `{ scope: "<owner-user-unit-id>", slug: "favorites" }` is provided
- **THEN** it SHALL pass schema validation
- **AND** the backend SHALL resolve it against shelves owned by that user unit

#### Scenario: SlugRef without scope is invalid

- **WHEN** a `SlugRef` value `{ slug: "light-novel" }` is provided (missing scope)
- **THEN** it SHALL fail schema validation

#### Scenario: SlugRef without slug is invalid

- **WHEN** a `SlugRef` value `{ scope: 'tag', unitId: "uuid-123" }` is provided (missing slug)
- **THEN** it SHALL fail schema validation

### Requirement: Backend SlugRef resolution

When the backend receives a `SlugRef` in a request, it SHALL resolve the reference to a `unitId` using the following strategy:

1. If `unitId` is present, use it directly (no lookup).
2. If only `scope` and `slug` are present, resolve `scope` to a `slugScope` Unit id (named scopes consult the `SlugScope` table; owner-unit-id scopes are used as-is) and query `Unit` by the composite `(slugScope, slug)` to obtain the `unitId`.

#### Scenario: SlugRef resolved via unitId

- **GIVEN** a `SlugRef` with `{ scope: 'tag', slug: "light-novel", unitId: "uuid-123" }`
- **WHEN** the backend resolves this reference
- **THEN** it SHALL use `unitId: "uuid-123"` directly without a database lookup

#### Scenario: Named-scope SlugRef resolved via slug lookup

- **GIVEN** a `SlugRef` with `{ scope: 'tag', slug: "light-novel" }` (no unitId)
- **WHEN** the backend resolves this reference
- **THEN** it SHALL look up the tag-scope Unit id via `SlugScope`
- **AND** query `Unit` where `(slugScope = <tag-scope-unit-id>, slug = "light-novel")` to obtain the `unitId`

#### Scenario: Owner-scope SlugRef resolved via slug lookup

- **GIVEN** a `SlugRef` with `{ scope: "<owner-user-unit-id>", slug: "favorites" }`
- **WHEN** the backend resolves this reference
- **THEN** it SHALL query `Unit` where `(slugScope = "<owner-user-unit-id>", slug = "favorites")` to obtain the `unitId`

#### Scenario: SlugRef with non-existent slug

- **GIVEN** a `SlugRef` with `{ scope: 'tag', slug: "does-not-exist" }`
- **WHEN** the backend resolves this reference
- **THEN** it SHALL treat the reference as not found and exclude it from the filter (not fail the entire request)
