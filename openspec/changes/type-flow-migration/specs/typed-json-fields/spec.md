## ADDED Requirements

### Requirement: Post extra schema
The contract SHALL define a `postExtraSchema` Typebox schema in `package/contract/src/post.ts` that describes the actual shape of `Post.extra`:
- `rating`: optional number
- `title`: optional string
- `book`: optional object with `{ id: string, title: string }`

The `PostDTO` schema SHALL use `postExtraSchema` for its `extra` field instead of `t.Any()`.

#### Scenario: Frontend accesses review rating without cast
- **WHEN** a component reads `review.extra.rating`
- **THEN** TypeScript infers the type as `number | undefined` without requiring `as any`

### Requirement: Shelf extra schema
The contract SHALL define a `shelfExtraSchema` Typebox schema in `package/contract/src/shelf.ts`:
- `viewMode`: optional string (or `ShelfView` union if defined)

The `ShelfDTO` schema SHALL use `shelfExtraSchema` for its `extra` field.

#### Scenario: Frontend accesses shelf viewMode without cast
- **WHEN** a component reads `shelf.extra.viewMode`
- **THEN** TypeScript infers the type as `string | undefined` without requiring `as any`

### Requirement: Book extra schema
The contract SHALL define a `bookExtraSchema` Typebox schema in `package/contract/src/book.ts`:
- `publishURL`: optional string

The `BookDTO` schema SHALL use `bookExtraSchema` for its `extra` field.

#### Scenario: Frontend accesses book publishURL without cast
- **WHEN** a component reads `book.extra.publishURL`
- **THEN** TypeScript infers the type as `string | undefined` without requiring `as any`

### Requirement: BookIndex index schema
The contract SHALL define a `bookIndexNodeSchema` in `package/contract/src/book.ts` that describes the chapter tree node shape used in `BookIndex.index`.

#### Scenario: Frontend iterates chapter index without cast
- **WHEN** a component maps over `bookIndex.index`
- **THEN** each element has typed properties (e.g., `unitId`, `title`) without `as any`

### Requirement: Score aggregate schemas
The contract SHALL define:
- `scoreDistributionSchema`: `t.Record(t.String(), t.Number())` for `ScoreAggregate.distribution`
- `scoreFieldsEntrySchema`: `t.Record(t.String(), t.Number())` for `ScoreEntry.fields`

#### Scenario: Frontend renders score distribution chart
- **WHEN** a component iterates `aggregate.distribution`
- **THEN** TypeScript infers entries as `[string, number]` without cast

### Requirement: ApiToken scopes schema
The contract SHALL define `apiTokenScopesSchema`: `t.Record(t.String(), t.Array(t.String()))` for `ApiToken.scopes`.

#### Scenario: Frontend formats token scopes
- **WHEN** a component reads `token.scopes`
- **THEN** TypeScript infers the type as `Record<string, string[]>` without cast

### Requirement: Unconsumed Json fields use t.Any
Any `Json`/`Json?` field in the Prisma schema that has no known frontend consumer SHALL use `t.Optional(t.Any())` in the Contract schema. This includes: `UnitTranslation.extra`, `Game.extra`, `Media.extra`, `Link.extra`, `ShelfItem.extra`, `Realm.extra`, `Person.extra`, `Organization.extra`.

#### Scenario: Unconsumed extra field does not constrain frontend
- **WHEN** a new feature needs to read `Game.extra.someField`
- **THEN** the developer adds a concrete schema to `gameExtraSchema` in contract before consuming it
