## ADDED Requirements

### Requirement: Realm placement is inherited; moderation state is per-node-per-context

Realm membership of content SHALL attach to thread roots through the existing realm placement junction, and replies SHALL inherit their thread's placement rather than joining realms independently. Moderation state SHALL be modeled separately from placement: a global content moderation state on the content node, and a sparse realm-scoped overlay keyed by `(realmUnitId, targetUnitId)` that MAY target any node, including a reply.

#### Scenario: Reply has no independent realm membership

- **GIVEN** a thread root is placed in realm A and realm B
- **WHEN** a reply is added to the thread
- **THEN** the reply SHALL NOT create its own realm placement row
- **AND** the reply SHALL be visible wherever its thread is placed, subject to moderation state

### Requirement: Realm-scoped tombstone hides a node only within one realm

A realm moderation overlay row with a tombstone or hidden state SHALL cause the targeted node to render as a removed stub only when the thread is viewed in that realm's context. The same node SHALL remain intact when the thread is viewed in another realm or on the global object, unless the node also carries a global moderation state.

#### Scenario: Realm mod tombstones a reply in realm A only

- **GIVEN** a thread is placed in realm A and realm B
- **AND** a realm A moderator tombstones reply `R`
- **WHEN** a viewer reads the thread through realm A
- **THEN** reply `R` SHALL render as a removed stub
- **AND** reply `R`'s child replies SHALL remain visible under the stub
- **WHEN** a viewer reads the thread through realm B or on the author profile
- **THEN** reply `R` SHALL render its full content

### Requirement: Global moderation state overrides realm context

A node carrying a global moderation state of hidden or removed (set by site staff with the appropriate capability, or by author deletion) SHALL render as removed in every realm context and on the global object. Render resolution SHALL apply global state first, then the realm overlay.

#### Scenario: Site staff removal is global

- **GIVEN** site staff with `content.takedown` removes a reply globally
- **WHEN** the thread is viewed through any realm or on the profile
- **THEN** the reply SHALL render as a removed stub everywhere
- **AND** a moderation case and staff audit entry SHALL record the global removal

### Requirement: Tombstones preserve thread integrity and are reversible

Tombstoning a node SHALL retain the node in the tree so descendant replies stay reachable, SHALL exclude tombstoned content from search and feed surfaces for the affected context, and SHALL be reversible by an authorized actor with the corresponding scope. Realm-scoped removal SHALL NOT alter the content's global publication state.

#### Scenario: Realm tombstone does not delete the global object

- **GIVEN** a reply is tombstoned in realm A
- **WHEN** the realm A moderator later reverses the decision
- **THEN** the reply SHALL render its full content in realm A again
- **AND** the reply's global object and its visibility in realm B SHALL have been unaffected throughout

### Requirement: Realm overlay is applied at render time; confidential exclusions stay server-side

Because realm-scoped overlays mark content that is unwelcome in one realm but remains public elsewhere, they are non-confidential and SHALL be applied at render time by composing a realm-agnostic content payload with a per-realm overlay set, rather than by contextualizing the content payload per realm. Confidential exclusions — global removal, member-only/private realm visibility, and age gating — SHALL be enforced server-side and SHALL NOT rely on client-side masking. The overlay set fetched for a view SHALL be bounded to the node ids being rendered, not the whole realm.

#### Scenario: Realm-agnostic payload composed with a per-realm overlay

- **WHEN** a viewer opens a thread in realm A
- **THEN** the realm-agnostic thread payload and a per-realm overlay set for the thread's node ids SHALL be retrieved as separately cacheable sources
- **AND** nodes present in the overlay SHALL render as removed stubs without the content payload being made realm-specific

#### Scenario: Confidential removal is not client-masked

- **GIVEN** content is globally removed or belongs to a member-only realm the viewer cannot access
- **WHEN** the thread is requested
- **THEN** the server SHALL exclude or null that content in the response
- **AND** the system SHALL NOT ship the content and rely on the client to hide it

### Requirement: Top-level removal uses junction-drop, not the overlay

Removing a top-level item from a realm feed SHALL be a placement junction operation so the item is simply absent from the realm's feed query, keeping pagination counts stable without overlay involvement. Tombstone stubs SHALL occupy a position in their thread so reply pagination counts remain stable. The overlay is primarily a thread-internal (reply-level) concern.

#### Scenario: Feed removal does not destabilize pagination

- **WHEN** a moderator removes a top-level post from realm A's feed
- **THEN** the post SHALL be absent from realm A's feed query through junction-drop
- **AND** realm A feed pagination SHALL NOT depend on the overlay to hide it

#### Scenario: Reply stub keeps reply pagination stable

- **GIVEN** a thread page renders a fixed number of replies
- **WHEN** one reply is tombstoned in the realm
- **THEN** the tombstoned reply SHALL render as a stub occupying its position
- **AND** the page's reply count SHALL remain stable
