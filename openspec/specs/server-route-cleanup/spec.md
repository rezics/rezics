## Purpose

Defines the migration from legacy domain-specific routes to unified Unit-backed server routes, including the Post API that replaces separate comment and review APIs.

## Removed Requirements

### Requirement: Comment API routes

**Reason**: The Comment domain (`comment.api.ts`, `comment.service.ts`, `CommentIndex` model) is eliminated. Comments are unified into the Post model with `kindKey = 'reply'` and tree structure via `parentPostUnitId`/`rootPostUnitId`/`sortPath`.

**Migration**: All endpoints under `/comment` (create comment, list comments by target, get comment thread) are replaced by Post API endpoints filtered by `kindKey` and `targetUnitId`. Clients must switch to Post API contracts.

### Requirement: Review API routes

**Reason**: The Review domain (`review.api.ts`, `review.service.ts`) is eliminated. Reviews are Posts with `kindKey = 'review'` and a `targetUnitId` pointing to the reviewed unit. Review-specific display (rating, body) is handled by Post fields and the engagement layer (Rating model).

**Migration**: All endpoints under `/review` (create review, list reviews for a unit, get review by id) are replaced by Post API endpoints filtered by `kindKey = 'review'`. Clients must switch to Post API contracts.

### Requirement: ReadList API routes

**Reason**: The ReadList domain (`readlist.api.ts`, `readlist.service.ts`, `ReadList` model, `SeriesBook` junction) is eliminated. ReadLists and Series are replaced by the universal Shelf model with `ShelfItem` junction supporting ordered collections, review-driven shelves, and series volume labels.

**Migration**: All endpoints under `/readlist` (create readlist, add/remove books, reorder, list user readlists) are replaced by Shelf API endpoints. `SeriesBook` data migrates to `ShelfItem` with `label` and `sortOrder`. Clients must switch to Shelf API contracts.

## Requirements

### Requirement: Post API provides unified comment, review, and discussion routes

The server SHALL expose a Post API under the `/post` prefix that handles creation, retrieval, updating, and deletion of all post types (comments, reviews, discussions, notes). The `kindKey` field SHALL distinguish post types. All post routes SHALL operate on Unit + Post records together.

#### Scenario: Create a review post targeting a book

- **WHEN** an authenticated user sends `POST /post` with `{ targetUnitId: "<book-unit-id>", kindKey: "review", body: "Great book..." }`
- **THEN** the server SHALL create a Unit with `type = POST` and a Post record with the provided `targetUnitId`, `kindKey`, and `body`
- AND the response SHALL include the created post with its `unitId`

#### Scenario: Create a reply post (comment) in a thread

- **WHEN** an authenticated user sends `POST /post` with `{ targetUnitId: "<unit-id>", parentPostUnitId: "<parent-post-id>", kindKey: "reply", body: "I agree..." }`
- **THEN** the server SHALL create a Post with the correct `rootPostUnitId`, `parentPostUnitId`, `depth`, and `sortPath` values
- AND the parent post's `replyCount` and `directReplyCount` SHALL be incremented

#### Scenario: List posts by target unit and kind

- **WHEN** a client sends `GET /post?targetUnitId=<id>&kindKey=review`
- **THEN** the server SHALL return paginated Post records matching the filter
- AND each post SHALL include the author information and engagement counts

#### Scenario: List threaded replies using sortPath ordering

- **WHEN** a client sends `GET /post?rootPostUnitId=<id>&threaded=true`
- **THEN** the server SHALL return posts ordered by `sortPath` for Reddit-style thread display

#### Scenario: List a descendant subtree from an arbitrary reply

- **WHEN** a client sends `GET /post/list?rootPostUnitId=<root-id>&subtreeRootPostUnitId=<reply-id>&mode=threaded&maxDepth=2`
- **THEN** the server SHALL treat `<reply-id>` as the subtree anchor and return only descendants of that reply
- AND the server SHALL NOT include the anchor reply itself in the returned posts
- AND `maxDepth` SHALL be interpreted relative to the anchor reply's depth
- AND the returned posts SHALL be ordered by `sortPath` for threaded display

#### Scenario: Update a post body

- **WHEN** the post owner sends `PUT /post/:unitId` with `{ body: "Updated text" }`
- **THEN** the server SHALL update the Post's `body` field
- AND the Unit's `updatedAt` SHALL be refreshed

#### Scenario: Delete a post (soft-delete)

- **WHEN** the post owner sends `DELETE /post/:unitId`
- **THEN** the server SHALL set the Unit's `status` to `DELETED`
- AND the post SHALL no longer appear in public queries

### Requirement: Shelf API provides universal collection management routes

The server SHALL expose a Shelf API under the `/shelf` prefix that handles creation, retrieval, updating, and deletion of shelves and their items. Shelves replace ReadLists and Series with a unified model supporting ordered collections, review-driven shelves, and series volume labels.

#### Scenario: Create a shelf

- **WHEN** an authenticated user sends `POST /shelf` with `{ kindKey: "collection" }`
- **THEN** the server SHALL create a Unit with `type = SHELF` and a Shelf record with the provided `kindKey`
- AND the Shelf SHALL have a UnitTranslation for its title in the user's language

#### Scenario: Add an item to a shelf

- **WHEN** the shelf owner sends `POST /shelf/:shelfUnitId/item` with `{ itemUnitId: "<unit-id>", sortOrder: 0 }`
- **THEN** the server SHALL create a ShelfItem record linking the item to the shelf
- AND the ShelfItem SHALL have the specified `sortOrder`

#### Scenario: Add a review-driven item to a shelf

- **WHEN** the shelf owner sends `POST /shelf/:shelfUnitId/item` with `{ itemUnitId: "<unit-id>", reviewPostUnitId: "<review-id>" }`
- **THEN** the server SHALL create a ShelfItem with the `reviewPostUnitId` linking the item to its review

#### Scenario: Reorder shelf items

- **WHEN** the shelf owner sends `PUT /shelf/:shelfUnitId/reorder` with an ordered list of `itemUnitId` values
- **THEN** the server SHALL update `sortOrder` on each ShelfItem to reflect the new ordering

#### Scenario: Remove an item from a shelf

- **WHEN** the shelf owner sends `DELETE /shelf/:shelfUnitId/item/:itemUnitId`
- **THEN** the server SHALL delete the ShelfItem record
- AND the shelf's remaining items SHALL retain their relative ordering

#### Scenario: List shelves for a user

- **WHEN** a client sends `GET /shelf?userId=<id>`
- **THEN** the server SHALL return paginated Shelf records owned by that user with their UnitTranslation titles

### Requirement: Realm API provides community organization routes

The server SHALL expose a Realm API under the `/realm` prefix that handles CRUD operations for realms and realm membership management. Realms are Units with `type = REALM` and a Realm extension record.

#### Scenario: Create a realm

- **WHEN** an authenticated user sends `POST /realm` with `{ isPublic: true }`
- **THEN** the server SHALL create a Unit with `type = REALM` and a Realm record
- AND the creating user SHALL be added as a RealmMember with `roleKey = "owner"`
- AND the Realm's `memberCount` SHALL be set to 1

#### Scenario: Get realm details

- **WHEN** a client sends `GET /realm/:realmUnitId`
- **THEN** the server SHALL return the Realm record with its UnitTranslation (name, description) and member count

#### Scenario: Join a public realm

- **WHEN** an authenticated user sends `POST /realm/:realmUnitId/member`
- **THEN** the server SHALL create a RealmMember record with `roleKey = "member"`
- AND the Realm's `memberCount` SHALL be incremented

#### Scenario: Leave a realm

- **WHEN** a member sends `DELETE /realm/:realmUnitId/member`
- **THEN** the server SHALL delete the RealmMember record
- AND the Realm's `memberCount` SHALL be decremented
- AND if the user's `roleKey` was `"owner"`, the server SHALL reject the request unless ownership is transferred first

#### Scenario: Update member role

- **WHEN** a realm owner sends `PUT /realm/:realmUnitId/member/:userId` with `{ roleKey: "moderator" }`
- **THEN** the server SHALL update the RealmMember's `roleKey`

### Requirement: Realm organization routes manage content feed and scoped tagging

The server SHALL expose routes for managing RealmUnit (content feed) and RealmTagApplication (scoped classification) under the `/realm` prefix. These are the mechanisms by which content enters a realm and is classified with tags within that realm.

#### Scenario: Add a unit to a realm's content feed

- **WHEN** a realm moderator sends `POST /realm/:realmUnitId/unit` with `{ unitId: "<unit-id>" }`
- **THEN** the server SHALL create a RealmUnit record linking the unit to the realm

#### Scenario: Remove a unit from a realm's content feed

- **WHEN** a realm moderator sends `DELETE /realm/:realmUnitId/unit/:unitId`
- **THEN** the server SHALL delete the RealmUnit record
- AND the unit's RealmTagApplication records for that realm SHALL also be deleted (scoped tags removed)
- AND global UnitTag records SHALL NOT be affected (no-removal-cascade)

#### Scenario: Classify a unit with a tag within a realm

- **WHEN** a realm moderator sends `POST /realm/:realmUnitId/tag` with `{ tagUnitId: "<tag-id>", unitId: "<unit-id>" }`
- **THEN** the server SHALL create a RealmTagApplication record
- AND the server SHALL upsert the global UnitTag for `(unitId, tagUnitId)` with a score increment (add-cascade)

#### Scenario: Remove a realm-scoped tag classification

- **WHEN** a realm moderator sends `DELETE /realm/:realmUnitId/tag/:tagUnitId/unit/:unitId`
- **THEN** the server SHALL delete the RealmTagApplication record
- AND the global UnitTag for `(unitId, tagUnitId)` SHALL NOT be modified (no-removal-cascade)

#### Scenario: List units in a realm's content feed

- **WHEN** a client sends `GET /realm/:realmUnitId/unit`
- **THEN** the server SHALL return paginated units in the realm ordered by `RealmUnit.createdAt`

#### Scenario: List tags applied to a unit within a realm

- **WHEN** a client sends `GET /realm/:realmUnitId/unit/:unitId/tag`
- **THEN** the server SHALL return all RealmTagApplication records for that realm-unit pair with their tag UnitTranslation labels

### Requirement: TagVote routes allow users to vote on tag relevance

The server SHALL expose TagVote routes under the `/tag-vote` prefix that allow authenticated users to upvote or downvote a tag's relevance to a specific unit. Votes affect the global UnitTag score.

#### Scenario: Upvote a tag on a unit

- **WHEN** an authenticated user sends `POST /tag-vote` with `{ unitId: "<unit-id>", tagUnitId: "<tag-id>", value: 1 }`
- **THEN** the server SHALL create or update a TagVote record with `value = 1`
- AND the UnitTag's `score` SHALL be incremented and `voteCount` updated

#### Scenario: Downvote a tag on a unit

- **WHEN** an authenticated user sends `POST /tag-vote` with `{ unitId: "<unit-id>", tagUnitId: "<tag-id>", value: -1 }`
- **THEN** the server SHALL create or update a TagVote record with `value = -1`
- AND the UnitTag's `score` SHALL be decremented and `voteCount` updated

#### Scenario: Change an existing vote

- **WHEN** a user who previously voted `+1` sends `POST /tag-vote` with `{ unitId: "<unit-id>", tagUnitId: "<tag-id>", value: -1 }`
- **THEN** the server SHALL update the TagVote's `value` from `1` to `-1`
- AND the UnitTag's `score` SHALL be adjusted by `-2` (reversing the old vote and applying the new one)

#### Scenario: Remove a vote

- **WHEN** an authenticated user sends `DELETE /tag-vote?unitId=<id>&tagUnitId=<id>`
- **THEN** the server SHALL delete the TagVote record
- AND the UnitTag's `score` and `voteCount` SHALL be adjusted accordingly

### Requirement: Book API rewritten for new domain structure

The Book API SHALL be rewritten to operate on Unit + Book extension + UnitTranslation records. Book routes SHALL use UnitTranslation for title/description, PersonCredit/OrgCredit for attribution, and UnitTag for tags. The Book model no longer carries `title`, `description`, `author`, `press`, `producer`, `tags`, or `anchorId`.

#### Scenario: Create a book

- **WHEN** an authenticated user sends `POST /book` with book metadata and a title/description per language
- **THEN** the server SHALL create a Unit with `type = BOOK`, a Book extension record with language-neutral facts (`isbn13`, `pageCount`, `formatKey`, etc.), and UnitTranslation records for the provided languages

#### Scenario: Get a book with resolved translation

- **WHEN** a client sends `GET /book/:unitId` with an `Accept-Language` header
- **THEN** the server SHALL return the Book extension data joined with the resolved UnitTranslation (following the fallback chain) and attribution from PersonCredit/OrgCredit

#### Scenario: Update book attribution

- **WHEN** the book owner sends `PUT /book/:unitId/credits` with `{ persons: [{ personId, roleKey: "author" }], organizations: [{ organizationId, roleKey: "publisher" }] }`
- **THEN** the server SHALL replace PersonCredit and OrgCredit records for that unit

### Requirement: Tag API rewritten for scored flat tags

The Tag API SHALL be rewritten to operate on Unit + UnitTranslation records for tag identity and UnitTag for scored associations. Tags are Units with `type = TAG` and `isLanguageNeutral = true`. The Tag model's `name`, `i18n`, and `type` fields are replaced by UnitTranslation.

#### Scenario: Create a tag

- **WHEN** a privileged user sends `POST /tag` with multilingual labels
- **THEN** the server SHALL create a Unit with `type = TAG`, `isLanguageNeutral = true`, and UnitTranslation records for each provided language label

#### Scenario: Get tags for a unit sorted by score

- **WHEN** a client sends `GET /unit/:unitId/tag`
- **THEN** the server SHALL return UnitTag records for that unit ordered by `score` descending, with each tag's UnitTranslation label resolved for the requested language

#### Scenario: Search tags by name

- **WHEN** a client sends `GET /tag?q=<search-term>&lang=<language>`
- **THEN** the server SHALL search UnitTranslation records where `unit.type = TAG` and `title` matches the search term in the specified language

### Requirement: Unit API rewritten for new type enum and no text columns

The Unit API SHALL reflect the updated Unit model: no `title` or `content` columns, updated `UnitType` enum (`BOOK`, `GAME`, `MEDIA`, `POST`, `TAG`, `REALM`, `SHELF`, `CHAPTER`, `IMAGE`, `VIDEO`, `QUOTE`), and new fields (`workUnitId`, `defaultLanguage`, `isLanguageNeutral`, `visibility`, `rating`). Unit queries SHALL join UnitTranslation for display text.

#### Scenario: Get a unit with translation

- **WHEN** a client sends `GET /unit/:id` with an `Accept-Language` header
- **THEN** the server SHALL return the Unit record joined with the resolved UnitTranslation
- AND the response SHALL NOT include `title` or `content` as direct Unit fields

#### Scenario: List units by type

- **WHEN** a client sends `GET /unit?type=BOOK&status=PUBLISHED`
- **THEN** the server SHALL return paginated units matching the filter with their resolved translations

### Requirement: Server route cleanup uses RealmTagApplication names

Server route documentation and route summaries SHALL refer to `RealmTagApplication` for realm-scoped tag classification routes. Route cleanup specs SHALL NOT describe the triple-level application row as `RealmTagUnit`.

#### Scenario: Realm classification routes use new names

- **WHEN** OpenAPI details are generated for realm-scoped tag classification
- **THEN** create, patch, delete, and vote summaries SHALL use `RealmTagApplication` or `RealmTagApplicationVote` vocabulary
- **AND** no generated summary SHALL describe the route as managing `RealmTagUnit`
