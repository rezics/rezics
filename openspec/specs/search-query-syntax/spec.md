# search-query-syntax Specification

## Purpose

Defines the structured `SearchQuery` type exported from
`@rezics/contract` and the `parseSearchString` /
`serializeSearchString` round-trip in the frontend `search` feature.
Owns the token grammar (`[slug]`, `type:`, `kind:`, `lang:`,
`rating:`, `licensed:`, `in:`, `sort:`) that turns user input into
typed filters, and enforces that syntax parsing is a frontend-only
concern — the backend only receives structured `ContentSearchOptions`.

## Requirements

### Requirement: SearchQuery structured type in contract

The `@rezics/contract` package SHALL export a `SearchQuery` type that represents a fully parsed, structured search query. This type SHALL include:

| Field        | Type          | Description                                    |
|--------------|---------------|------------------------------------------------|
| `keyword`    | `string?`     | Free-text keyword portion                      |
| `tags`       | `SlugRef[]?`  | Tag filters extracted from `[slug]` tokens     |
| `type`       | `string[]?`   | Content type filters from `type:value` tokens  |
| `kind`       | `string?`     | Post-kind filter from `kind:value` tokens (one of `review`, `excerpt`, `remark`, `chapter`, `post`, normalized to canonical `PostKind` value) |
| `languages`  | `string[]?`   | Language filters from `lang:value` tokens      |
| `ratings`    | `ContentRating[]?` | Rating filters from `rating:value` tokens |
| `isLicensed` | `boolean?`    | Licensed filter from `licensed:yes\|no`        |
| `realm`      | `SlugRef?`    | Realm scope from `in:realm-slug`               |
| `sort`       | `string?`     | Sort preference from `sort:value`              |

#### Scenario: SearchQuery is importable from contract

- **WHEN** a consumer imports `SearchQuery` from `@rezics/contract`
- **THEN** it SHALL be a Typebox schema usable for type inference and runtime validation

#### Scenario: SearchQuery accepts kind field

- **WHEN** a Typebox validator checks `{ kind: "REVIEW" }`
- **THEN** it SHALL pass validation
- **AND** SHALL reject values outside the canonical `PostKind` set with a clear validation error

### Requirement: Search syntax parser in frontend

The `search` feature in `package/app` SHALL export a `parseSearchString(input: string): SearchQuery` function that extracts structured tokens from a raw search string. The parser SHALL recognize the following token patterns:

| Pattern             | Meaning              | Example                    |
|---------------------|----------------------|----------------------------|
| `[slug]`            | Tag filter by slug   | `[light-novel]`            |
| `type:value`        | Content type         | `type:book`                |
| `lang:value`        | Language             | `lang:ja`                  |
| `rating:value`      | Content rating       | `rating:r15`               |
| `licensed:yes\|no`  | Licensed toggle      | `licensed:yes`             |
| `in:slug`           | Realm scope          | `in:my-realm`              |
| `sort:value`        | Sort order           | `sort:newest`              |
| Unmatched text      | Keyword              | `異世界 冒険`              |

#### Scenario: Parse mixed search string

- **WHEN** `parseSearchString("[light-novel] type:book 異世界")` is called
- **THEN** the result SHALL be `{ tags: [{ slug: "light-novel" }], type: ["book"], keyword: "異世界" }`

#### Scenario: Parse string with multiple tags

- **WHEN** `parseSearchString("[isekai] [adventure] fantasy")` is called
- **THEN** the result SHALL be `{ tags: [{ slug: "isekai" }, { slug: "adventure" }], keyword: "fantasy" }`

#### Scenario: Parse string with no tokens

- **WHEN** `parseSearchString("just a keyword search")` is called
- **THEN** the result SHALL be `{ keyword: "just a keyword search" }`

#### Scenario: Parse empty string

- **WHEN** `parseSearchString("")` is called
- **THEN** the result SHALL be `{}`

### Requirement: Search string serializer in frontend

The `search` feature SHALL export a `serializeSearchString(query: SearchQuery): string` function that converts a structured `SearchQuery` back into the syntax string representation. This is used for displaying the current search state in the input field.

#### Scenario: Serialize structured query to string

- **WHEN** `serializeSearchString({ tags: [{ slug: "light-novel" }], type: ["book"], keyword: "異世界" })` is called
- **THEN** the result SHALL be `"[light-novel] type:book 異世界"` (or equivalent ordering)

#### Scenario: Round-trip consistency

- **GIVEN** a search string `input`
- **WHEN** `serializeSearchString(parseSearchString(input))` is called
- **THEN** re-parsing the result SHALL produce an identical `SearchQuery` structure

### Requirement: Search syntax is a frontend concern

The backend SHALL NOT parse search syntax strings. The frontend is responsible for converting user input into structured `SearchQuery` objects, and then into `ContentSearchOptions` for API submission. The backend only receives `ContentSearchOptions`.

#### Scenario: Backend receives structured options not syntax strings

- **WHEN** the frontend submits a search
- **THEN** the request body SHALL conform to `ContentSearchOptions`
- **AND** SHALL NOT contain a raw search syntax string

### Requirement: kind: token recognized by parser

The `parseSearchString` parser exported from `@/search` SHALL recognize the token pattern `kind:value` (case-insensitive on the literal `kind`) and write the normalized `PostKind` value (uppercased canonical form: `REVIEW`, `EXCERPT`, `REMARK`, `CHAPTER`, `POST`) onto `SearchQuery.kind`. Multiple `kind:` tokens SHALL collapse to the last occurrence (the token is single-valued, not array-valued). Unknown values (e.g., `kind:foo`) SHALL be silently dropped — neither raised as an error nor written onto the structured query — preserving the parser's existing tolerance pattern for invalid `type:` values.

#### Scenario: Parser extracts kind:review

- **WHEN** `parseSearchString("kind:review magic")` is called
- **THEN** the result SHALL be `{ kind: "REVIEW", keyword: "magic" }`

#### Scenario: Last kind: wins when repeated

- **WHEN** `parseSearchString("kind:review kind:excerpt")` is called
- **THEN** the result SHALL be `{ kind: "EXCERPT" }`
- **AND** SHALL NOT be an array

#### Scenario: Invalid kind value is dropped

- **WHEN** `parseSearchString("kind:bogus magic")` is called
- **THEN** the result SHALL be `{ keyword: "magic" }`
- **AND** SHALL NOT include a `kind` field

#### Scenario: Kind serializes round-trip

- **GIVEN** `serializeSearchQuery({ kind: "REVIEW", keyword: "magic" })`
- **WHEN** the result is fed back into `parseSearchString`
- **THEN** the parsed structure SHALL equal `{ kind: "REVIEW", keyword: "magic" }`
