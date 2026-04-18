## ADDED Requirements

### Requirement: SlugRef type in contract

The `@rezics/contract` package SHALL export a `SlugRef` Typebox schema representing a unit reference by slug with an optional `unitId` for performance. The type SHALL be:

```typescript
type SlugRef = {
  slug: string       // Required — the human-readable slug
  unitId?: string    // Optional — the UUID, included when known for zero-cost lookup
}
```

#### Scenario: SlugRef with both slug and unitId

- **WHEN** a `SlugRef` value `{ slug: "light-novel", unitId: "uuid-123" }` is provided
- **THEN** it SHALL pass schema validation

#### Scenario: SlugRef with slug only

- **WHEN** a `SlugRef` value `{ slug: "light-novel" }` is provided
- **THEN** it SHALL pass schema validation

#### Scenario: SlugRef without slug is invalid

- **WHEN** a `SlugRef` value `{ unitId: "uuid-123" }` is provided (missing slug)
- **THEN** it SHALL fail schema validation

### Requirement: Backend SlugRef resolution

When the backend receives a `SlugRef` in a request, it SHALL resolve the reference to a `unitId` using the following strategy:

1. If `unitId` is present, use it directly (no lookup).
2. If only `slug` is present, query `Unit` by the unique `slug` field to obtain the `unitId`.

#### Scenario: SlugRef resolved via unitId

- **GIVEN** a `SlugRef` with `{ slug: "light-novel", unitId: "uuid-123" }`
- **WHEN** the backend resolves this reference
- **THEN** it SHALL use `unitId: "uuid-123"` directly without a database lookup

#### Scenario: SlugRef resolved via slug lookup

- **GIVEN** a `SlugRef` with `{ slug: "light-novel" }` (no unitId)
- **WHEN** the backend resolves this reference
- **THEN** it SHALL query `Unit` where `slug = "light-novel"` to obtain the `unitId`

#### Scenario: SlugRef with non-existent slug

- **GIVEN** a `SlugRef` with `{ slug: "does-not-exist" }`
- **WHEN** the backend resolves this reference
- **THEN** it SHALL treat the tag as not found and exclude it from the filter (not fail the entire request)
