## ADDED Requirements

### Requirement: ReplyComposer accepts realmUnitIds and tagIds for top-level realm posts

`ReplyComposer` (`package/app/src/post/forms/`) SHALL accept two new optional props: `realmUnitIds?: string[]` and `tagIds?: string[]`. When `realmUnitIds` is non-empty, the composer enters "top-level realm post" mode: `targetUnitId` and `parentPostUnitId` SHALL NOT be required, the composer surfaces a tag picker, and on submission the create-post call SHALL include `realmUnitIds` and the user-selected tag ids. The mode SHALL be mutually exclusive with reply mode at the prop level — a TypeScript discriminated union SHALL prevent passing both `realmUnitIds` and `targetUnitId`/`parentPostUnitId` at the same time.

#### Scenario: Composer in realm-post mode does not require target

- **WHEN** a developer renders `<ReplyComposer mode="expanded" realmUnitIds={["realm-1"]} />`
- **THEN** the component SHALL render without requiring `targetUnitId` or `parentPostUnitId` props
- **AND** the body input SHALL accept content normally

#### Scenario: Composer in reply mode rejects realmUnitIds

- **WHEN** a developer attempts to pass `<ReplyComposer realmUnitIds={["realm-1"]} targetUnitId="post-x" />`
- **THEN** TypeScript compilation SHALL fail with a discriminated-union type error
- **AND** the runtime SHALL also assert and reject this combination

#### Scenario: Submission carries realmUnitIds and tagIds

- **GIVEN** a `<ReplyComposer realmUnitIds={["realm-1", "realm-2"]} />` with body "Hello"
- **AND** the user has selected tags `tag-a` and `tag-b` in the picker
- **WHEN** the user clicks Post
- **THEN** the call to `createPost` SHALL include `{ body: "Hello", realmUnitIds: ["realm-1", "realm-2"], tagIds: ["tag-a", "tag-b"] }`
- **AND** SHALL NOT include `targetUnitId` or `parentPostUnitId`

### Requirement: Tag picker hydrates from the realm's extra.tagTree

When the composer is in realm-post mode and exactly one realm id is in `realmUnitIds`, the tag picker SHALL render quick-pick chips/sections derived from that realm's `extra.tagTree`. Each leaf node with a `tagId` SHALL render as a selectable chip. Each node with `disabled: true` SHALL render as a non-selectable header/group label. Multi-select SHALL be supported. The picker SHALL also expose a search field that queries the global tag pool (via the existing tag search API) and lets the user pick any global tag, not just those in the tree.

When `realmUnitIds` contains multiple realms, the picker SHALL hydrate from the first realm's `tagTree` and a single advisory note SHALL inform the user that quick-picks reflect only that realm.

#### Scenario: Picker shows quick-picks from tagTree

- **GIVEN** realm-1 has `extra.tagTree = [{ disabled: true, label: "Genre", children: [{ tagId: "action" }, { tagId: "romance" }] }]`
- **WHEN** the composer is opened with `realmUnitIds={["realm-1"]}`
- **THEN** the picker SHALL render a non-selectable "Genre" header
- **AND** beneath it, two selectable chips: "action" and "romance" (rendered with their resolved tag titles)

#### Scenario: User can pick a tag outside tagTree via search

- **GIVEN** realm-1's `tagTree` does not include `tag-fantasy`
- **WHEN** the user types "fantasy" in the picker search field
- **THEN** the picker SHALL surface `tag-fantasy` as a result (via global tag search)
- **AND** the user SHALL be able to select it
- **AND** on submission, `tagIds` SHALL include `tag-fantasy`

#### Scenario: Disabled node is not selectable

- **GIVEN** `extra.tagTree` contains a node `{ disabled: true, label: "Genre", children: [...] }`
- **WHEN** the picker renders the node
- **THEN** clicking on the "Genre" label SHALL NOT add anything to selected tags
- **AND** the label SHALL be visually distinguished from selectable chips

#### Scenario: Empty tagTree shows search-only picker

- **GIVEN** realm-1 has no `extra.tagTree` (or an empty array)
- **WHEN** the composer is opened with `realmUnitIds={["realm-1"]}`
- **THEN** the picker SHALL render only the search field
- **AND** no quick-pick chips SHALL appear

### Requirement: Submission writes Post + RealmUnit + UnitTag in one transaction

When the composer submits in realm-post mode, the resulting `createPost` server call SHALL execute a single transaction that creates the `Post`, the `RealmUnit` rows for each id in `realmUnitIds`, and the `UnitTag` rows for each id in `tagIds`. If any insert fails, the entire transaction SHALL roll back and the composer SHALL surface the error to the user. The composer SHALL NOT issue separate sequential write calls per id.

#### Scenario: All inserts succeed

- **WHEN** a user submits a post with `realmUnitIds: ["realm-1"]` and `tagIds: ["tag-a", "tag-b"]`
- **AND** all inserts succeed
- **THEN** one Post, one `RealmUnit("realm-1", postUnitId)`, and two `UnitTag` rows SHALL exist
- **AND** the composer SHALL clear and dismiss

#### Scenario: A failing insert rolls back the whole creation

- **GIVEN** `tag-x` does not exist in the database
- **WHEN** a user submits with `tagIds: ["tag-a", "tag-x"]`
- **THEN** the transaction SHALL fail
- **AND** no Post SHALL be created
- **AND** no `RealmUnit` or `UnitTag` rows SHALL persist
- **AND** the composer SHALL surface the error and remain mounted with the draft preserved

### Requirement: RealmPage exposes a "post in this realm" entry point

The realm detail page (`/realm/:realmId`) SHALL render a "post in this realm" entry point — a button or composer affordance — visible to authenticated users who are members of the realm. Clicking it SHALL open a `<ReplyComposer mode="expanded" realmUnitIds={[realmId]} />`. The entry point SHALL be placed in the realm header area or above the Feed tab content. Non-members SHALL NOT see the entry point unless realm settings explicitly permit non-member posting (deferred — out of this change's scope; default is members-only).

#### Scenario: Member sees the post entry point

- **GIVEN** an authenticated user who is a member of realm-1
- **WHEN** the user views `/realm/realm-1`
- **THEN** a "post in this realm" button or affordance SHALL be visible

#### Scenario: Clicking entry point opens composer in realm-post mode

- **WHEN** the member clicks the "post in this realm" button
- **THEN** a `<ReplyComposer mode="expanded" realmUnitIds={["realm-1"]} />` SHALL mount
- **AND** the body input SHALL be focused
- **AND** the tag picker SHALL be hydrated from `realm-1.extra.tagTree`

#### Scenario: Non-member does not see the entry point

- **GIVEN** an authenticated user who is not a member of realm-1
- **WHEN** the user views `/realm/realm-1`
- **THEN** the "post in this realm" entry point SHALL NOT be visible
- **AND** the user SHALL still see the Join button

#### Scenario: Unauthenticated user does not see the entry point

- **GIVEN** an unauthenticated visitor
- **WHEN** they view `/realm/realm-1`
- **THEN** the post entry point SHALL NOT be rendered
