## ADDED Requirements

### Requirement: PostKind exported as typed const enum

The contract SHALL export a `PostKind` const enum from `@rezics/contract` with exactly four values: `REVIEW`, `REMARK`, `QUOTE`, `POST`. PostKind SHALL be the single source of truth for valid post kinds across all packages. No other values SHALL be accepted as valid post kinds.

#### Scenario: Import PostKind from the contract

- **WHEN** a consumer imports `PostKind` from `@rezics/contract`
- **THEN** the available values SHALL be exactly `PostKind.REVIEW`, `PostKind.REMARK`, `PostKind.QUOTE`, and `PostKind.POST`
- **AND** no `COMMENT` value SHALL exist on the enum

#### Scenario: PostKind values are string literals

- **WHEN** a consumer inspects a PostKind value
- **THEN** each value SHALL be the uppercase string literal matching its name (e.g., `PostKind.REVIEW === 'REVIEW'`)

### Requirement: PostDTO.kind typed as PostKind union

The `kind` field on `PostDTO` in the contract SHALL be typed as a union of PostKind literal values (`'REVIEW' | 'REMARK' | 'QUOTE' | 'POST'`) instead of `t.Optional(t.String())`. The field SHALL remain optional for backward compatibility with existing posts that may lack a kind value.

#### Scenario: PostDTO.kind accepts valid PostKind value

- **WHEN** a PostDTO is constructed with `kind: 'REVIEW'`
- **THEN** the value SHALL pass type checking and runtime validation

#### Scenario: PostDTO.kind rejects invalid string

- **WHEN** a PostDTO is constructed with `kind: 'COMMENT'`
- **THEN** the value SHALL fail runtime validation
- **AND** TypeScript SHALL report a type error at compile time

#### Scenario: PostDTO.kind remains optional

- **WHEN** a PostDTO is constructed without a `kind` field
- **THEN** the value SHALL pass validation
- **AND** the field SHALL be `undefined`

### Requirement: CreatePostInput.kind typed to PostKind values

The `kind` field on `CreatePostInput` in the contract SHALL be typed as a required union of PostKind literal values (`'REVIEW' | 'REMARK' | 'QUOTE' | 'POST'`). Every new post creation MUST specify a valid kind.

#### Scenario: Create post with valid kind

- **WHEN** a client submits a CreatePostInput with `kind: 'REMARK'`
- **THEN** the input SHALL pass validation

#### Scenario: Create post with invalid kind rejected

- **WHEN** a client submits a CreatePostInput with `kind: 'COMMENT'`
- **THEN** the input SHALL fail validation with a type error

#### Scenario: Create post without kind rejected

- **WHEN** a client submits a CreatePostInput without a `kind` field
- **THEN** the input SHALL fail validation as `kind` is required

### Requirement: build-url.ts uses PostKind for post routing

The `buildUrl` utility SHALL route POST-type units based on their PostKind value. `REVIEW` SHALL route to `/review/:id`. `REMARK` SHALL route to `/remark/:id`. `QUOTE` SHALL route to `/quote/:id`. `POST` SHALL route to `/post/:id`. SHELF-type units SHALL route to `/shelf/:id`. The utility SHALL NOT reference `UnitType.COMMENT`, `UnitType.NOTE`, `UnitType.REVIEW`, or `UnitType.READLIST`.

#### Scenario: Build URL for a review post

- **WHEN** `buildUrl` is called with a unit of type POST and kind REVIEW
- **THEN** the returned URL SHALL be `/review/:id`

#### Scenario: Build URL for a shelf

- **WHEN** `buildUrl` is called with a unit of type SHELF
- **THEN** the returned URL SHALL be `/shelf/:id`

#### Scenario: No COMMENT or READLIST branches in URL builder

- **WHEN** the `buildUrl` source is inspected
- **THEN** it SHALL contain no references to `COMMENT`, `NOTE`, `REVIEW`, or `READLIST` as UnitType values

### Requirement: Frontend UnitType references cleaned up

All frontend code SHALL reference only valid `UnitType` values as defined in the contract. References to `UnitType.COMMENT`, `UnitType.NOTE`, `UnitType.REVIEW`, and `UnitType.READLIST` SHALL NOT exist in any frontend source file. Components that previously filtered or displayed by these invalid values SHALL be updated to use `PostKind` or valid `UnitType` values.

#### Scenario: UserUnitsPage does not reference invalid UnitType values

- **WHEN** the `UserUnitsPage` component source is inspected
- **THEN** it SHALL contain no references to `COMMENT`, `NOTE`, `REVIEW`, or `READLIST` as UnitType values

#### Scenario: UnitsPage does not reference invalid UnitType values

- **WHEN** the `UnitsPage` component source is inspected
- **THEN** it SHALL contain no references to `COMMENT`, `NOTE`, `REVIEW`, or `READLIST` as UnitType values

#### Scenario: Frontend compiles without UnitType errors

- **WHEN** the frontend is compiled with strict TypeScript
- **THEN** no type errors SHALL be reported for UnitType usage
- **AND** no references to removed UnitType values SHALL exist

### Requirement: Frontend code using UnitType.COMMENT or UnitType.NOTE updated

All frontend code that previously used `UnitType.COMMENT` or `UnitType.NOTE` to categorize or filter content SHALL be updated. Code that handled comments SHALL use `PostKind` filtering (e.g., posts with `parentPostUnitId` set). Code that handled notes SHALL use `PostKind.POST` or be removed if the note concept no longer applies.

#### Scenario: Comment filtering replaced with post threading check

- **WHEN** frontend code needs to identify reply posts (formerly "comments")
- **THEN** it SHALL check for the presence of `parentPostUnitId` on the post
- **AND** it SHALL NOT reference `UnitType.COMMENT` or `PostKind.COMMENT`

#### Scenario: Note references removed or remapped

- **WHEN** frontend code previously referenced `UnitType.NOTE`
- **THEN** the reference SHALL be removed or replaced with the appropriate `PostKind` value
- **AND** no `UnitType.NOTE` reference SHALL remain in the codebase

## REMOVED Requirements

### Requirement: PostKind.COMMENT in Prisma enum

**Reason:** The `COMMENT` value in the `PostKind` Prisma enum conflates structural role (reply) with content kind. A comment is structurally a Post with `parentPostUnitId != null` -- threading fields (`parentPostUnitId`, `rootPostUnitId`, `depth`, `sortPath`) fully describe the reply relationship. Keeping `COMMENT` as a kind encourages incorrect usage patterns and contradicts the design decision that `kind` represents content form, not structural role.

**Migration:** Remove `COMMENT` from the `PostKind` enum in the Prisma schema. Existing database rows with `kind = 'COMMENT'` remain as-is (no data migration in this change). New post creation no longer accepts `COMMENT` as a valid kind value.

### Requirement: Contract stub files comment.ts, review.ts, readlist.ts

**Reason:** The files `comment.ts`, `review.ts`, and `readlist.ts` in `package/contract/src/` are empty stubs that export no types or schemas. They were placeholders for domains that have been unified into the Post and Shelf models. Retaining them creates false import targets and misleads consumers into expecting dedicated contracts for these domains.

**Migration:** Delete `package/contract/src/comment.ts`, `package/contract/src/review.ts`, and `package/contract/src/readlist.ts`. Any imports referencing these files SHALL be removed or redirected to `post.ts` or `shelf.ts` as appropriate. Compilation will surface any remaining references as import errors.

### Requirement: comment/ server domain

**Reason:** The `package/server/src/comment/` domain is dead code. It references a `CommentIndex` table that does not exist in the Prisma schema or in any migration file. The domain cannot function and has never been operational. All comment/reply functionality is handled by the Post model with threading fields.

**Migration:** Delete the entire `package/server/src/comment/` directory and remove its `.use()` mount from `package/server/src/index.ts`. No API consumers are affected because the endpoints reference a non-existent database table and would fail at runtime.
