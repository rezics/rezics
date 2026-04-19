## ADDED Requirements

### Requirement: PostKind.CHAPTER enum value

The `PostKind` enum (in both the Prisma schema and the `@rezics/contract` TypeScript export) SHALL include `CHAPTER` as a valid value alongside the existing `REVIEW`, `EXCERPT`, `REMARK`, and `POST` values. Consumers SHALL be able to create, list, filter, and route posts of kind `CHAPTER` using the same contract surface as any other `PostKind`.

#### Scenario: PostKind includes CHAPTER

- WHEN a consumer inspects the `PostKind` enum exported by `@rezics/contract`
- THEN the enum values SHALL include `REVIEW`, `EXCERPT`, `REMARK`, `POST`, and `CHAPTER`
- AND `PostKind.CHAPTER` SHALL equal the string literal `"CHAPTER"`

#### Scenario: PostDTO.kind accepts CHAPTER

- WHEN a `PostDTO` is constructed with `kind: "CHAPTER"`
- THEN the value SHALL pass type checking and runtime validation

#### Scenario: CreatePostInput accepts CHAPTER

- WHEN a client submits a `CreatePostInput` with `kind: "CHAPTER"`, a valid `targetUnitId` pointing to a BOOK, and a `body`
- THEN the input SHALL pass validation
- AND the resulting post SHALL be persisted with `kind = CHAPTER`

### Requirement: build-url routes CHAPTER posts to chapter URLs

The `buildUrl` utility SHALL route POST-type units whose `PostKind = CHAPTER` to a chapter-specific URL pattern consistent with the existing per-kind routing convention (e.g., `/chapter/:id` or `/book/:bookId/chapter/:id` — implementation chooses one). The utility SHALL NOT treat chapter posts as generic posts and SHALL NOT route them to `/post/:id`.

#### Scenario: Build URL for a chapter post

- WHEN `buildUrl` is called with a unit of `type = POST` and `kind = CHAPTER`
- THEN the returned URL SHALL match the chapter URL pattern defined by the utility
- AND SHALL NOT equal the `/post/:id` generic route

### Requirement: unitTranslationExtraSchema exported alongside post contracts

The `@rezics/contract` package SHALL export `unitTranslationExtraSchema` (the Typebox schema governing `UnitTranslation.extra`) and its inferred type. Post DTO builders that surface a flat `coverUrl` field (on chapter, review, or any future post kind needing a cover) SHALL resolve the value through this schema rather than reading `extra` as an untyped JSON blob.

#### Scenario: Contract exports the extra schema

- WHEN a consumer imports from `@rezics/contract`
- THEN `unitTranslationExtraSchema` SHALL be a named export
- AND the inferred TypeScript type SHALL include `coverUrl?: string`

#### Scenario: Post DTO cover resolution uses the schema

- GIVEN a post with a `UnitTranslation` whose `extra = { coverUrl: "https://example.com/c.jpg" }`
- WHEN the post DTO is constructed via the contract-typed accessor
- THEN the DTO SHALL expose `coverUrl = "https://example.com/c.jpg"`
- AND the accessor SHALL NOT read `extra` with an untyped index signature
