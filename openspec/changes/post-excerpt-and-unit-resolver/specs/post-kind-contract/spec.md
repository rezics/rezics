## MODIFIED Requirements

### Requirement: PostKind exported as typed const enum

The contract SHALL export a `PostKind` const enum from `@rezics/contract` with exactly four values: `REVIEW`, `REMARK`, `EXCERPT`, `POST`. PostKind SHALL be the single source of truth for valid post kinds across all packages. No other values SHALL be accepted as valid post kinds. The previous value `QUOTE` is renamed to `EXCERPT`; `QUOTE` SHALL NOT exist on the enum.

#### Scenario: Import PostKind from the contract

- **WHEN** a consumer imports `PostKind` from `@rezics/contract`
- **THEN** the available values SHALL be exactly `PostKind.REVIEW`, `PostKind.REMARK`, `PostKind.EXCERPT`, and `PostKind.POST`
- **AND** no `COMMENT` value SHALL exist on the enum
- **AND** no `QUOTE` value SHALL exist on the enum

#### Scenario: PostKind values are string literals

- **WHEN** a consumer inspects a PostKind value
- **THEN** each value SHALL be the uppercase string literal matching its name (e.g., `PostKind.REVIEW === 'REVIEW'`, `PostKind.EXCERPT === 'EXCERPT'`)

### Requirement: PostDTO.kind typed as PostKind union

The `kind` field on `PostDTO` in the contract SHALL be typed as a union of PostKind literal values (`'REVIEW' | 'REMARK' | 'EXCERPT' | 'POST'`) instead of `t.Optional(t.String())`. The field SHALL remain optional for backward compatibility with existing posts that may lack a kind value.

#### Scenario: PostDTO.kind accepts valid PostKind value

- **WHEN** a PostDTO is constructed with `kind: 'REVIEW'`
- **THEN** the value SHALL pass type checking and runtime validation

#### Scenario: PostDTO.kind accepts EXCERPT

- **WHEN** a PostDTO is constructed with `kind: 'EXCERPT'`
- **THEN** the value SHALL pass type checking and runtime validation

#### Scenario: PostDTO.kind rejects invalid string

- **WHEN** a PostDTO is constructed with `kind: 'COMMENT'` or `kind: 'QUOTE'`
- **THEN** the value SHALL fail runtime validation
- **AND** TypeScript SHALL report a type error at compile time

#### Scenario: PostDTO.kind remains optional

- **WHEN** a PostDTO is constructed without a `kind` field
- **THEN** the value SHALL pass validation
- **AND** the field SHALL be `undefined`

### Requirement: CreatePostInput.kind typed to PostKind values

The `kind` field on `CreatePostInput` in the contract SHALL be typed as a required union of PostKind literal values (`'REVIEW' | 'REMARK' | 'EXCERPT' | 'POST'`). Every new post creation MUST specify a valid kind.

#### Scenario: Create post with valid kind

- **WHEN** a client submits a CreatePostInput with `kind: 'REMARK'`
- **THEN** the input SHALL pass validation

#### Scenario: Create excerpt post

- **WHEN** a client submits a CreatePostInput with `kind: 'EXCERPT'`
- **THEN** the input SHALL pass validation

#### Scenario: Create post with invalid kind rejected

- **WHEN** a client submits a CreatePostInput with `kind: 'COMMENT'` or `kind: 'QUOTE'`
- **THEN** the input SHALL fail validation with a type error

#### Scenario: Create post without kind rejected

- **WHEN** a client submits a CreatePostInput without a `kind` field
- **THEN** the input SHALL fail validation as `kind` is required

### Requirement: build-url.ts uses PostKind for post routing

The `buildUrl` utility SHALL route POST-type units based on their PostKind value. `REVIEW` SHALL route to `/review/:id`. `REMARK` SHALL route to `/remark/:id`. `EXCERPT` SHALL route to `/excerpt/:id`. `POST` SHALL route to `/post/:id`. SHELF-type units SHALL route to `/shelf/:id`. The utility SHALL NOT reference `UnitType.COMMENT`, `UnitType.NOTE`, `UnitType.REVIEW`, `UnitType.READLIST`, or any `QUOTE`-named branch.

#### Scenario: Build URL for a review post

- **WHEN** `buildUrl` is called with a unit of type POST and kind REVIEW
- **THEN** the returned URL SHALL be `/review/:id`

#### Scenario: Build URL for an excerpt post

- **WHEN** `buildUrl` is called with a unit of type POST and kind EXCERPT
- **THEN** the returned URL SHALL be `/excerpt/:id`

#### Scenario: Build URL for a shelf

- **WHEN** `buildUrl` is called with a unit of type SHELF
- **THEN** the returned URL SHALL be `/shelf/:id`

#### Scenario: No COMMENT, READLIST, or QUOTE branches in URL builder

- **WHEN** the `buildUrl` source is inspected
- **THEN** it SHALL contain no references to `COMMENT`, `NOTE`, `REVIEW`, `READLIST`, or `QUOTE` as branch labels

### Requirement: Frontend UnitType references cleaned up

All frontend code SHALL reference only valid `UnitType` values as defined in the contract. References to `UnitType.COMMENT`, `UnitType.NOTE`, `UnitType.REVIEW`, and `UnitType.READLIST` SHALL NOT exist in any frontend source file. Components that previously filtered or displayed by these invalid values SHALL be updated to use `PostKind` or valid `UnitType` values. Any reference to `PostKind.QUOTE` SHALL be replaced with `PostKind.EXCERPT`.

#### Scenario: UserUnitsPage does not reference invalid UnitType values

- **WHEN** the `UserUnitsPage` component source is inspected
- **THEN** it SHALL contain no references to `COMMENT`, `NOTE`, `REVIEW`, or `READLIST` as UnitType values

#### Scenario: UnitsPage does not reference invalid UnitType values

- **WHEN** the `UnitsPage` component source is inspected
- **THEN** it SHALL contain no references to `COMMENT`, `NOTE`, `REVIEW`, or `READLIST` as UnitType values

#### Scenario: Frontend uses EXCERPT instead of QUOTE

- **WHEN** any frontend source file references `PostKind`
- **THEN** it SHALL use `PostKind.EXCERPT` (never `PostKind.QUOTE`)

#### Scenario: Frontend compiles without UnitType errors

- **WHEN** the frontend is compiled with strict TypeScript
- **THEN** no type errors SHALL be reported for UnitType usage
- **AND** no references to removed UnitType values SHALL exist

### Requirement: Frontend code using UnitType.COMMENT or UnitType.NOTE updated

All frontend code that previously used `UnitType.COMMENT` or `UnitType.NOTE` to categorize or filter content SHALL be updated. Code that handled comments SHALL use `PostKind` filtering (e.g., posts with `parentPostUnitId` set). Code that handled notes SHALL use `PostKind.POST` or be removed if the note concept no longer applies.

#### Scenario: Comment-related frontend code uses Post API

- **WHEN** frontend code that previously handled comments is inspected
- **THEN** it SHALL use Post API queries with `parentPostUnitId` filtering instead of UnitType filtering

## ADDED Requirements

### Requirement: PostListQuery.kind narrowed to PostKind union

The `kind` field on `postListQuerySchema` (used by the post-list endpoint) SHALL be typed as `t.Optional(postKindLiterals)` rather than `t.Optional(t.String())`. The backend SHALL NOT cast the value to `PostKind`; it SHALL pass the validated value directly to Prisma.

#### Scenario: Frontend sends uppercase enum value

- **WHEN** a frontend caller invokes the post-list endpoint with `kind: 'REVIEW'`
- **THEN** the request SHALL pass schema validation and Prisma SHALL receive the value `'REVIEW'`

#### Scenario: Frontend sends lowercase string

- **WHEN** a frontend caller invokes the post-list endpoint with `kind: 'review'`
- **THEN** the request SHALL fail schema validation at the contract layer with a clear error
- **AND** the request SHALL NOT reach Prisma

#### Scenario: Backend service drops the cast

- **WHEN** `package/server/src/post/post.service.ts` is inspected
- **THEN** the `where.kind = query.kind` assignment SHALL NOT include an `as PostKind` cast (the contract type is sufficient)
