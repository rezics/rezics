## ADDED Requirements

### Requirement: SearchQuery structured type in contract

The `@rezics/contract` package SHALL export a `SearchQuery` type that represents a fully parsed, structured search query. This type SHALL include:

| Field       | Type          | Description                                    |
|-------------|---------------|------------------------------------------------|
| `keyword`   | `string?`     | Free-text keyword portion                      |
| `tags`      | `SlugRef[]?`  | Tag filters extracted from `[slug]` tokens     |
| `type`      | `string[]?`   | Content type filters from `type:value` tokens  |
| `languages` | `string[]?`   | Language filters from `lang:value` tokens      |
| `ratings`   | `ContentRating[]?` | Rating filters from `rating:value` tokens |
| `isLicensed`| `boolean?`    | Licensed filter from `licensed:yes\|no`        |
| `realm`     | `SlugRef?`    | Realm scope from `in:realm-slug`               |
| `sort`      | `string?`     | Sort preference from `sort:value`              |

#### Scenario: SearchQuery is importable from contract

- **WHEN** a consumer imports `SearchQuery` from `@rezics/contract`
- **THEN** it SHALL be a Typebox schema usable for type inference and runtime validation

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
