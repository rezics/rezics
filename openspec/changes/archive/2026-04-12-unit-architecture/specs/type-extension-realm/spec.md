## ADDED Requirements

### Requirement: Realm creation produces Unit and Realm extension

A Realm SHALL be created as a 1:1 extension on a Unit with `type = REALM`. Creating a Realm MUST create both a Unit record and a Realm extension record in a single transaction. The Realm model SHALL have `unitId` as the primary key and foreign key to the parent Unit. Default values SHALL be `isPublic = true`, `isOfficial = false`, `memberCount = 0`. The Realm model SHALL have an `extra` field of type Json for extensible metadata.

#### Scenario: Create a public realm

- GIVEN an authenticated user with userId "user-1"
- WHEN the user creates a Realm with name "Fantasy Readers"
- THEN a Unit with `type = REALM` SHALL be created with `userId = "user-1"`
- AND a Realm extension record SHALL be created with `isPublic = true`, `isOfficial = false`, `memberCount = 0`
- AND the creator SHALL be added as a RealmMember with `roleKey = "owner"`

#### Scenario: Create a private realm

- GIVEN an authenticated user with userId "user-1"
- WHEN the user creates a Realm with `isPublic = false`
- THEN the Realm extension record SHALL be created with `isPublic = false`
- AND only invited users SHALL be able to join

### Requirement: Realm membership with join, leave, and role assignment

Users SHALL be able to join and leave Realms via RealmMember records. RealmMember SHALL use a composite primary key of (`realmUnitId`, `userId`). Each RealmMember SHALL have a `roleKey` (owner, moderator, member), `joinedAt`, and `updatedAt` timestamps.

#### Scenario: User joins a public realm

- GIVEN a public Realm "realm-1" and a user "user-2" who is not a member
- WHEN "user-2" joins "realm-1"
- THEN a RealmMember record SHALL be created with `realmUnitId = "realm-1"`, `userId = "user-2"`, `roleKey = "member"`, and `joinedAt` set to the current timestamp

#### Scenario: User leaves a realm

- GIVEN a RealmMember record for "user-2" in "realm-1" with `roleKey = "member"`
- WHEN "user-2" leaves "realm-1"
- THEN the RealmMember record SHALL be deleted
- AND "user-2" SHALL no longer have access to member-only features of "realm-1"

#### Scenario: Assign moderator role

- GIVEN a Realm "realm-1" with owner "user-1" and member "user-2"
- WHEN "user-1" assigns `roleKey = "moderator"` to "user-2"
- THEN the RealmMember record for "user-2" SHALL have `roleKey = "moderator"` and `updatedAt` set to the current timestamp

### Requirement: Role hierarchy enforces permissions

Realm roles SHALL follow a strict hierarchy: owner > moderator > member. Owners SHALL have full control over realm settings, membership, and moderation. Moderators SHALL be able to perform tagging and moderation operations. Members SHALL be able to participate in discussions and content within the realm.

#### Scenario: Owner can perform all operations

- GIVEN a Realm "realm-1" with owner "user-1"
- WHEN "user-1" attempts to modify realm settings, manage members, or moderate content
- THEN all operations SHALL be permitted

#### Scenario: Moderator cannot modify realm settings

- GIVEN a Realm "realm-1" with moderator "user-2"
- WHEN "user-2" attempts to modify realm settings (e.g., isPublic, name)
- THEN the system SHALL deny the operation
- AND only owner-level actions SHALL be restricted

#### Scenario: Member cannot perform moderation

- GIVEN a Realm "realm-1" with member "user-3"
- WHEN "user-3" attempts to perform a moderation action (e.g., lock a post, remove content)
- THEN the system SHALL deny the operation

### Requirement: isPublic controls join policy

When `isPublic = true`, any authenticated user SHALL be able to join the Realm freely. When `isPublic = false`, users SHALL only be able to join via an invitation from an owner or moderator.

#### Scenario: Join a public realm without invitation

- GIVEN a Realm "realm-1" with `isPublic = true` and user "user-2"
- WHEN "user-2" requests to join "realm-1"
- THEN a RealmMember record SHALL be created with `roleKey = "member"`
- AND no invitation SHALL be required

#### Scenario: Reject uninvited join to private realm

- GIVEN a Realm "realm-2" with `isPublic = false` and user "user-2" without an invitation
- WHEN "user-2" attempts to join "realm-2"
- THEN the system SHALL reject the join request
- AND no RealmMember record SHALL be created

#### Scenario: Accept invited join to private realm

- GIVEN a Realm "realm-2" with `isPublic = false` and an invitation issued to "user-2"
- WHEN "user-2" accepts the invitation
- THEN a RealmMember record SHALL be created with `roleKey = "member"`

### Requirement: isOfficial marks Rezics-maintained realms

The `isOfficial` field SHALL default to `false`. When `isOfficial = true`, the Realm is recognized as maintained by the Rezics platform team. Only system-level operations SHALL be able to set `isOfficial = true`; regular users MUST NOT be able to create or modify a realm to be official.

#### Scenario: Default official status on creation

- WHEN a user creates a new Realm
- THEN the Realm SHALL be created with `isOfficial = false`

#### Scenario: System sets a realm as official

- GIVEN a Realm "realm-1" with `isOfficial = false`
- WHEN a system-level operation sets `isOfficial = true`
- THEN the Realm record SHALL have `isOfficial = true`

#### Scenario: Regular user cannot set isOfficial

- GIVEN an authenticated user with userId "user-1" who owns Realm "realm-1"
- WHEN "user-1" attempts to set `isOfficial = true` on "realm-1"
- THEN the system SHALL reject the operation
- AND `isOfficial` SHALL remain `false`

### Requirement: memberCount denormalized and updated on join and leave

The Realm model SHALL maintain a `memberCount` integer field (default 0) that reflects the current number of RealmMember records. This count MUST be incremented by 1 when a user joins the realm and decremented by 1 when a user leaves the realm.

#### Scenario: memberCount increments on join

- GIVEN a Realm "realm-1" with `memberCount = 5`
- WHEN a new user joins "realm-1"
- THEN the Realm's `memberCount` SHALL become 6

#### Scenario: memberCount decrements on leave

- GIVEN a Realm "realm-1" with `memberCount = 5`
- WHEN an existing member leaves "realm-1"
- THEN the Realm's `memberCount` SHALL become 4

#### Scenario: memberCount is never negative

- GIVEN a Realm "realm-1" with `memberCount = 0`
- WHEN a leave operation is triggered (edge case)
- THEN the Realm's `memberCount` SHALL remain 0

### Requirement: Realm name and description via UnitTranslation

The Realm's display name, description, and any other language-dependent text SHALL be stored in UnitTranslation records linked to the Realm's parent Unit. The Realm extension model MUST NOT contain `name`, `description`, or `title` columns. This provides multilingual support for realm metadata.

#### Scenario: Set realm name in a single language

- GIVEN a Realm with unitId "realm-1"
- WHEN the owner sets the name to "Fantasy Readers" in English
- THEN a UnitTranslation record SHALL be created with `unitId = "realm-1"`, `langCode = "en"`, and `title = "Fantasy Readers"`

#### Scenario: Multilingual realm name

- GIVEN a Realm with unitId "realm-1" and an English UnitTranslation
- WHEN the owner adds a Japanese translation with `title` set to the Japanese equivalent
- THEN a second UnitTranslation record SHALL be created with `unitId = "realm-1"` and `langCode = "ja"`
- AND the system SHALL serve the appropriate translation based on user language preference

### Requirement: Only moderators and owners can perform realm-tag operations

Realm-tag operations (creating, editing, or removing tags scoped to a realm) SHALL be restricted to RealmMembers with `roleKey = "owner"` or `roleKey = "moderator"`. Members with `roleKey = "member"` MUST NOT be able to create, modify, or delete realm-scoped tags.

#### Scenario: Moderator creates a realm tag

- GIVEN a Realm "realm-1" and a RealmMember "user-2" with `roleKey = "moderator"`
- WHEN "user-2" creates a tag scoped to "realm-1"
- THEN the tag SHALL be created successfully

#### Scenario: Member cannot create a realm tag

- GIVEN a Realm "realm-1" and a RealmMember "user-3" with `roleKey = "member"`
- WHEN "user-3" attempts to create a tag scoped to "realm-1"
- THEN the system SHALL reject the operation with a permission error

#### Scenario: Non-member cannot manage realm tags

- GIVEN a Realm "realm-1" and a user "user-4" who is not a RealmMember
- WHEN "user-4" attempts to create a tag scoped to "realm-1"
- THEN the system SHALL reject the operation with a permission error

### Requirement: Owner can transfer ownership and modify realm settings

The Realm owner SHALL be able to transfer ownership to another RealmMember by setting the target member's `roleKey` to "owner" and demoting themselves. The owner SHALL also be able to modify realm settings including `isPublic` and realm metadata in UnitTranslation.

#### Scenario: Transfer ownership

- GIVEN a Realm "realm-1" with owner "user-1" and moderator "user-2"
- WHEN "user-1" transfers ownership to "user-2"
- THEN "user-2" SHALL have `roleKey = "owner"`
- AND "user-1" SHALL be demoted to `roleKey = "moderator"` or another designated role
- AND the Realm SHALL have exactly one owner at all times

#### Scenario: Owner modifies realm visibility

- GIVEN a Realm "realm-1" with `isPublic = true` and owner "user-1"
- WHEN "user-1" sets `isPublic = false`
- THEN the Realm record SHALL have `isPublic = false`
- AND existing members SHALL retain their membership

#### Scenario: Non-owner cannot modify realm settings

- GIVEN a Realm "realm-1" with moderator "user-2"
- WHEN "user-2" attempts to change `isPublic` or update the realm name
- THEN the system SHALL reject the operation
- AND the realm settings SHALL remain unchanged
