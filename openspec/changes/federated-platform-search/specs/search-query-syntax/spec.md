## MODIFIED Requirements

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

## ADDED Requirements

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
