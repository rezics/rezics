# realm-frontend Specification

## Purpose

Defines the realm-related frontend in `@rezics/app`: the realm landing page, search page with filtering and sorting, detail page with tabbed layout (content feed, tags, members), join/leave flow, management page for owners/admins, create-realm form, navigation entries, role-based UI visibility, and the manage-icon placement in the RealmPage header.
## Requirements
### Requirement: Realm landing page displays public and official realms
The route `/realm` SHALL render a landing page that displays public and official realms for discovery. The page SHALL show a curated selection of realms including an official realms section and a public realms section. Each realm SHALL be represented by a realm card. The page SHALL be accessible to both authenticated and unauthenticated users.

#### Scenario: Unauthenticated user views realm landing
- **WHEN** an unauthenticated user navigates to `/realm`
- **THEN** the page SHALL display sections for official realms and public realms
- **AND** each realm SHALL be rendered as a realm card showing name, description, member count, and badges

#### Scenario: No realms exist
- **WHEN** a user navigates to `/realm` and no realms are available
- **THEN** the page SHALL display an empty state indicating no realms are available yet

### Requirement: Realm search page with filtering and sorting
The route `/realm/search` SHALL render a search page that allows users to find realms by keyword, filter by public or official status, and sort by member count. The search SHALL be powered by the content search API.

#### Scenario: User searches realms by keyword
- **WHEN** a user enters a keyword in the realm search input
- **THEN** the page SHALL display realms whose name or description matches the keyword

#### Scenario: User filters by official status
- **WHEN** a user applies the "official" filter on the realm search page
- **THEN** only realms marked as official SHALL be displayed in the results

#### Scenario: User filters by public status
- **WHEN** a user applies the "public" filter on the realm search page
- **THEN** only realms marked as public SHALL be displayed in the results

#### Scenario: User sorts by member count
- **WHEN** a user selects "member count" as the sort option
- **THEN** the results SHALL be ordered by member count in descending order

### Requirement: Realm detail page with tabbed layout
The route `/realm/:realmId` SHALL render a realm detail page with the realm's name, description, and metadata in a header area, followed by a tabbed interface with three tabs: Feed, Tags, and Members.

#### Scenario: User views realm detail
- **WHEN** a user navigates to `/realm/:realmId`
- **THEN** the page SHALL display the realm's name, description, and metadata
- **AND** the page SHALL render three tabs: Feed, Tags, and Members
- **AND** the Feed tab SHALL be selected by default

#### Scenario: Realm not found
- **WHEN** a user navigates to `/realm/:realmId` with a non-existent realm ID
- **THEN** the page SHALL display a not-found state

### Requirement: Realm content feed tab
The Feed tab on the realm detail page SHALL display a paginated list of posts that have been added to the realm via the `RealmUnit` junction. The feed SHALL be loaded via the `byRealm(realmId)` query (`GET /post/list?realmUnitId=...`), NOT via `byTarget(realmId)`. The feed SHALL support sort modes (new/top/hot) and tag filtering (via `extra.tagTree` leaves) as defined by their respective requirements.

#### Scenario: Feed tab displays realm posts via byRealm

- **WHEN** a user selects the Feed tab on a realm detail page
- **THEN** the tab SHALL display a paginated list of posts retrieved via `byRealm(realmId)`
- **AND** each post SHALL be rendered with the appropriate post card

#### Scenario: Feed tab with no content

- **WHEN** a user selects the Feed tab and the realm has no `RealmUnit` rows
- **THEN** the tab SHALL display an empty state indicating the realm has no content yet

#### Scenario: Feed sort and filter compose

- **WHEN** a user selects sort=top and active filter chip "action" on the Feed tab
- **THEN** the feed SHALL issue `byRealm(realmId, { sort: "top", tagIds: ["action"] })`
- **AND** the result SHALL respect both sort and filter together

### Requirement: Realm tags tab with realm-scoped tag curation
The Tags tab on the realm detail page SHALL display realm-scoped tag-unit associations managed by realm moderators. Users with moderator role or above SHALL see controls to add or remove tag-unit associations within the realm context.

#### Scenario: User views realm tags
- **WHEN** a user selects the Tags tab on a realm detail page
- **THEN** the tab SHALL display the tag-unit associations curated for this realm

#### Scenario: Moderator adds a tag-unit association
- **WHEN** a user with moderator role or above adds a tag-unit association on the Tags tab
- **THEN** the system SHALL call the realm tag unit creation API
- **AND** the tag list SHALL update to reflect the new association

#### Scenario: Moderator removes a tag-unit association
- **WHEN** a user with moderator role or above removes a tag-unit association on the Tags tab
- **THEN** the system SHALL call the realm tag unit removal API
- **AND** the tag list SHALL update to reflect the removal

#### Scenario: Regular member cannot manage tags
- **WHEN** a user with member role views the Tags tab
- **THEN** tag management controls SHALL NOT be visible

### Requirement: Realm members tab with role badges
The Members tab on the realm detail page SHALL display a list of realm members. Each member entry SHALL show the user's display name and a badge indicating their role (owner, admin, moderator, or member).

#### Scenario: User views realm members
- **WHEN** a user selects the Members tab on a realm detail page
- **THEN** the tab SHALL display a list of all realm members
- **AND** each member SHALL display a role badge indicating their role

#### Scenario: Members sorted by role hierarchy
- **WHEN** a user views the Members tab
- **THEN** members SHALL be presented with higher-privilege roles (owner, admin, moderator) visually distinguishable from regular members

### Requirement: Join and leave realm with member count
The realm detail page SHALL display a join/leave button and the current member count. Authenticated users who are not members SHALL see a "Join" button. Authenticated users who are members SHALL see a "Leave" button. The member count SHALL update after join or leave actions.

#### Scenario: Non-member joins a realm
- **WHEN** an authenticated user who is not a member of the realm clicks the "Join" button
- **THEN** the system SHALL call the realm join API
- **AND** the button SHALL change to "Leave"
- **AND** the displayed member count SHALL increment

#### Scenario: Member leaves a realm
- **WHEN** an authenticated member of the realm clicks the "Leave" button
- **THEN** the system SHALL call the realm leave API
- **AND** the button SHALL change to "Join"
- **AND** the displayed member count SHALL decrement

#### Scenario: Unauthenticated user sees member count but no join button
- **WHEN** an unauthenticated user views a realm detail page
- **THEN** the member count SHALL be displayed
- **AND** no join or leave button SHALL be rendered

### Requirement: Realm management page for owner and admin
The route `/realm/:realmId/manage` SHALL render a management page accessible
only to users with owner or admin role in the realm, **or users with global
admin/root role**. The page SHALL allow editing realm metadata
(name/description through UnitTranslation, public/private metadata where
available), managing member roles, and deleting the realm (owner or global
admin/root only).

Realm title and description editing SHALL support all UnitTranslation languages
on the realm. The selected language SHALL render as a Select control with an
adjacent add-language action. Saving SHALL upsert the selected language's
UnitTranslation row.

#### Scenario: Owner accesses management page
- **WHEN** a realm owner navigates to `/realm/:realmId/manage`
- **THEN** the page SHALL display realm metadata editing controls, member role management, and a realm deletion option

#### Scenario: Admin accesses management page
- **WHEN** a realm admin navigates to `/realm/:realmId/manage`
- **THEN** the page SHALL display realm metadata editing controls and member role management
- **AND** the realm deletion option SHALL NOT be visible

#### Scenario: Global admin accesses management page of any realm
- **WHEN** a global admin navigates to `/realm/:realmId/manage` for a realm they do not own
- **THEN** the page SHALL display realm metadata editing controls, member role management, and the realm deletion option

#### Scenario: Admin manages member roles
- **WHEN** an admin changes a member's role on the management page
- **THEN** the system SHALL call the appropriate realm member role update API
- **AND** the member list SHALL refresh to reflect the change

#### Scenario: Owner deletes a realm
- **WHEN** a realm owner clicks the delete action and confirms
- **THEN** the system SHALL call the realm deletion API
- **AND** the user SHALL be navigated to `/realm`

#### Scenario: Translation update uses correct API
- **WHEN** a user edits the realm title or description on the manage page and saves
- **THEN** the system SHALL call the unit translation upsert endpoint (not embed translations in the realm update payload)

#### Scenario: Realm manager selects translation language

- **GIVEN** a realm has UnitTranslation rows for `["en", "zh-hant"]`
- **WHEN** a manager opens `/realm/:realmId/manage`
- **THEN** the current language SHALL be rendered with a Select control
- **AND** selecting `"zh-hant"` SHALL load that translation's title and
  description into the form

#### Scenario: Realm manager adds translation language

- **GIVEN** a realm has only an English UnitTranslation
- **WHEN** a manager adds `"ja"` from the language control
- **THEN** the form SHALL switch to `"ja"`
- **AND** saving SHALL create or update the realm's Japanese UnitTranslation

#### Scenario: Non-admin user denied access
- **WHEN** a user without owner/admin realm role and without global admin/root role navigates to `/realm/:realmId/manage`
- **THEN** the page SHALL redirect the user to the realm detail page

### Requirement: Create realm form
The route `/realm/new` SHALL render a form for creating a new realm. The form SHALL require a realm name (provided via translations), a description, and a public/private toggle. On successful creation, the user SHALL be navigated to the new realm's detail page.

#### Scenario: User creates a public realm
- **WHEN** an authenticated user fills in the realm name, description, sets the toggle to public, and submits
- **THEN** the system SHALL call the realm creation API with the provided data
- **AND** the user SHALL be navigated to `/realm/:newRealmId`

#### Scenario: User creates a private realm
- **WHEN** an authenticated user fills in the realm name, description, sets the toggle to private, and submits
- **THEN** the system SHALL call the realm creation API with the visibility set to private
- **AND** the user SHALL be navigated to `/realm/:newRealmId`

#### Scenario: Unauthenticated user cannot create realm
- **WHEN** an unauthenticated user navigates to `/realm/new`
- **THEN** the user SHALL be redirected to the authentication flow

#### Scenario: Form validation rejects empty name
- **WHEN** a user submits the create realm form without providing a name
- **THEN** the form SHALL display a validation error and SHALL NOT submit

### Requirement: Realm card component
The system SHALL provide a reusable realm card component that displays the realm's name, description (truncated), member count, and badges for public and official status. The card SHALL link to the realm's detail page.

#### Scenario: Realm card renders with full data
- **WHEN** a realm card is rendered with a realm that is public and official
- **THEN** the card SHALL display the realm name, truncated description, member count, a public badge, and an official badge
- **AND** clicking the card SHALL navigate to `/realm/:realmId`

#### Scenario: Realm card renders for private non-official realm
- **WHEN** a realm card is rendered with a realm that is private and not official
- **THEN** the card SHALL display the realm name, truncated description, and member count
- **AND** public and official badges SHALL NOT be displayed

### Requirement: Navigation sidebar entry for Realms
The application navigation sidebar SHALL include a "Realms" entry that links to `/realm`. The entry SHALL be placed alongside other content-type navigation items (Shelves, Reviews, etc.).

#### Scenario: Realms entry visible in sidebar
- **WHEN** a user views the navigation sidebar
- **THEN** a "Realms" entry SHALL be visible and SHALL link to `/realm`

#### Scenario: User clicks Realms navigation entry
- **WHEN** a user clicks the "Realms" entry in the sidebar
- **THEN** the application SHALL navigate to `/realm`

### Requirement: Create menu entry for Realm
The application's create menu (used for creating new content) SHALL include a "Realm" option that navigates to `/realm/new`.

#### Scenario: Realm option in create menu
- **WHEN** an authenticated user opens the create menu
- **THEN** a "Realm" option SHALL be available
- **AND** selecting it SHALL navigate to `/realm/new`

### Requirement: My Realms link in navigation
The application navigation SHALL include a "My Realms" entry that allows authenticated users to view their joined realms. This entry SHALL be placed in the personal section of the navigation alongside "My Shelves" and "My Reviews".

#### Scenario: Authenticated user sees My Realms link
- **WHEN** an authenticated user views the navigation sidebar
- **THEN** a "My Realms" entry SHALL be visible in the personal navigation section

#### Scenario: User clicks My Realms
- **WHEN** an authenticated user clicks the "My Realms" navigation entry
- **THEN** the application SHALL display the user's joined realms, fetched via the `GET /realms/me` endpoint

#### Scenario: Unauthenticated user does not see My Realms
- **WHEN** an unauthenticated user views the navigation sidebar
- **THEN** the "My Realms" entry SHALL NOT be visible

### Requirement: Backend endpoint GET /realms/me returns user's joined realms
The backend SHALL provide a `GET /realms/me` endpoint that returns the list of realms the authenticated user has joined. The endpoint SHALL require authentication. The response SHALL include realm metadata and the user's role in each realm.

#### Scenario: Authenticated user fetches joined realms
- **WHEN** an authenticated user calls `GET /realms/me`
- **THEN** the endpoint SHALL return a list of realms the user is a member of
- **AND** each entry SHALL include the realm metadata and the user's role in that realm

#### Scenario: User with no realm memberships
- **WHEN** an authenticated user with no realm memberships calls `GET /realms/me`
- **THEN** the endpoint SHALL return an empty list

#### Scenario: Unauthenticated request is rejected
- **WHEN** an unauthenticated request is made to `GET /realms/me`
- **THEN** the endpoint SHALL respond with an authentication error

### Requirement: Role-based UI visibility
The realm frontend SHALL conditionally display management controls based on the authenticated user's role within the realm **or their global system role**. Global admin and root users SHALL see all management controls regardless of realm membership. Moderator and above SHALL see tag management controls on the Tags tab. Admin and above SHALL see member role management controls on the Members tab and access to the management page. Only the owner (or global admin/root) SHALL see the realm deletion option.

#### Scenario: Global admin sees manage icon without realm membership
- **WHEN** a user with global role `ADMIN` views a realm detail page (without being a member)
- **THEN** a manage icon/button SHALL be visible in the realm header
- **AND** clicking it SHALL navigate to `/realm/:realmId/manage`

#### Scenario: Global root sees manage icon
- **WHEN** a user with global role `ROOT` views any realm detail page
- **THEN** a manage icon/button SHALL be visible in the realm header

#### Scenario: Realm moderator sees manage icon
- **WHEN** a user with realm role `moderator` views the realm detail page
- **THEN** a manage icon/button SHALL be visible in the realm header

#### Scenario: Realm admin sees manage icon
- **WHEN** a user with realm role `admin` views the realm detail page
- **THEN** a manage icon/button SHALL be visible in the realm header

#### Scenario: Regular member does not see manage icon
- **WHEN** a user with realm role `member` views the realm detail page
- **THEN** no manage icon/button SHALL be visible

#### Scenario: Non-member does not see manage icon
- **WHEN** a non-member user views a public realm detail page
- **THEN** no manage icon/button SHALL be visible

### Requirement: Realm seed produces non-null titles
The mock seed generator SHALL ensure that all seeded realms have at least one UnitTranslation row with a non-null, non-empty `title` field.

#### Scenario: Seeded realm has title
- **GIVEN** the mock seed has been run
- **WHEN** any realm is queried via the API
- **THEN** `unit.translations` SHALL contain at least one entry with a non-empty `title`

### Requirement: Manage icon placement in RealmPage header

The manage icon SHALL appear in the realm detail page header row, positioned near the realm title and join button. The icon SHALL be a `lucide-react` icon — preferably `Settings`, `Settings2`, or `SlidersHorizontal` — recorded in the rezics-design icon mapping table at `.claude/skills/rezics-design/icons.md`. The icon SHALL link to `/realm/:realmId/manage`.

#### Scenario: Manage icon renders in header

- **WHEN** a user with manage permission views the realm detail page
- **THEN** the realm header SHALL render a `lucide-react` settings icon (`Settings`, `Settings2`, or `SlidersHorizontal`) anchored near the realm title and join button
- **AND** the icon SHALL link to `/realm/:realmId/manage`
- **AND** the import SHALL come from `lucide-react`

### Requirement: RuleSection renders extra.rule on the realm detail page

When a realm has `extra.rule` set, the realm detail page (`/realm/:realmId`) SHALL render a `RuleSection` showing a summary of the rule Post (title, brief preview). Clicking the section SHALL open the same rule modal used by the join-rule-consent flow. The section SHALL be visible to all viewers (authenticated and unauthenticated, members and non-members) so that anyone can see the realm's rules without joining.

When `extra.rule` is unset or refers to a deleted/missing Post, the section SHALL NOT render.

#### Scenario: Rule section visible when set

- **GIVEN** realm-1 with `extra.rule = "post-rule-1"` and post-rule-1 exists
- **WHEN** any user views `/realm/realm-1`
- **THEN** a RuleSection SHALL be visible in the realm header or sidebar area
- **AND** it SHALL display the rule Post's title and a preview snippet

#### Scenario: Clicking rule section opens full modal

- **GIVEN** RuleSection is visible
- **WHEN** the user clicks it
- **THEN** the same modal used in the join-rule-consent flow SHALL open
- **AND** it SHALL render the full rule Post body
- **AND** since the user is not joining, the modal SHALL show a "Close" button instead of "Agree and Join"

#### Scenario: Rule section hidden when rule unset

- **GIVEN** realm-1 with no `extra.rule`
- **WHEN** any user views `/realm/realm-1`
- **THEN** RuleSection SHALL NOT render

### Requirement: AboutSection renders extra.about in the sidebar

When a realm has `extra.about` set, the realm detail page SHALL render an `AboutSection` in the sidebar (or a comparable side region) displaying the about Post's title and body content. The body SHALL render with multi-language resolution via the existing pinboard rendering pipeline (work-release self-relation + UnitTranslation).

When `extra.about` is unset or refers to a deleted/missing Post, the section SHALL NOT render.

#### Scenario: About section visible when set

- **GIVEN** realm-1 with `extra.about = "post-about-1"` and post-about-1 exists
- **WHEN** any user views `/realm/realm-1`
- **THEN** an AboutSection SHALL render in the sidebar with the about Post's title and body

#### Scenario: About section uses release for user language

- **GIVEN** post-about-1 has releases for `zh-hant` and `ja`
- **WHEN** a user with locale `zh-hant` views the about section
- **THEN** the body SHALL render the `zh-hant` release content

### Requirement: BannerSection renders extra.banner above realm header

When a realm has `extra.banner` set, the realm detail page SHALL render a `BannerSection` at the top of the page. When `banner.kind = "url"`, the section SHALL render an image element with `src = banner.url`. When `banner.kind = "post"`, the section SHALL fetch the referenced Post and render an image derived from the Post's first image asset (or its `extra.coverUrl` if provided), falling back to a textual title-only banner if no image is found.

When `extra.banner` is unset, the section SHALL NOT render.

#### Scenario: URL-form banner renders image

- **GIVEN** realm-1 with `extra.banner = { kind: "url", url: "/banners/cover.jpg" }`
- **WHEN** any user views `/realm/realm-1`
- **THEN** a BannerSection SHALL render an `<img src="/banners/cover.jpg">` element at the top of the page

#### Scenario: Post-form banner resolves Post image

- **GIVEN** realm-1 with `extra.banner = { kind: "post", unitId: "post-banner-1" }` and post-banner-1 has an image asset
- **WHEN** any user views `/realm/realm-1`
- **THEN** a BannerSection SHALL render the Post's image

### Requirement: RealmFeedSortSwitcher exposes new/top/hot

The realm detail page's Feed tab SHALL render a sort switcher control offering three options: New, Top, Hot. The default selection SHALL be New. Selecting an option SHALL re-issue the `byRealm` query with the corresponding `sort` parameter and re-render the feed accordingly. The selected sort SHALL be reflected in the URL (query parameter `sort=new|top|hot`) so the state is shareable and survives page reload.

#### Scenario: Default sort is New

- **WHEN** a user navigates to `/realm/realm-1` (no `sort` query param)
- **THEN** the sort switcher SHALL show "New" as selected
- **AND** the feed SHALL be ordered by `createdAt DESC`

#### Scenario: User switches to Top

- **WHEN** the user clicks "Top" in the sort switcher
- **THEN** the URL SHALL update to `/realm/realm-1?sort=top` (or replace existing `sort`)
- **AND** the feed SHALL re-issue `byRealm("realm-1", { sort: "top" })`
- **AND** the order SHALL be by score DESC

#### Scenario: Sort persists across reload

- **GIVEN** the user is on `/realm/realm-1?sort=hot`
- **WHEN** the user reloads the page
- **THEN** the sort switcher SHALL show "Hot" as selected on mount
- **AND** the feed SHALL load with `sort: "hot"`

### Requirement: RealmFeedTagFilter filters feed by tagTree leaf nodes

The realm detail page's Feed tab SHALL render a tag-filter control sourced from the realm's `extra.tagTree`. The control SHALL surface each leaf node (any node with `tagId`, regardless of `disabled` — disabled leaves SHALL be excluded from the filter) as a selectable filter chip. Multiple chips SHALL be selectable simultaneously (OR semantics). When at least one chip is active, the feed SHALL re-issue `byRealm` with the corresponding `tagIds` parameter. Active filters SHALL appear in the URL (query parameter `tags=t1,t2`).

When `extra.tagTree` is unset or contains no tag-bearing leaves, the filter control SHALL NOT render.

#### Scenario: Filter chips reflect tagTree leaves

- **GIVEN** realm-1 with `extra.tagTree = [{ disabled: true, label: "Genre", children: [{ tagId: "action" }, { tagId: "romance" }] }]`
- **WHEN** a user views the Feed tab
- **THEN** the tag filter SHALL render two chips: "action" and "romance"
- **AND** the "Genre" header SHALL render as a non-clickable label

#### Scenario: Selecting a chip filters the feed

- **WHEN** the user clicks the "action" chip
- **THEN** the URL SHALL update to include `tags=action`
- **AND** the feed SHALL re-issue `byRealm("realm-1", { tagIds: ["action"] })`

#### Scenario: Multiple chips use OR

- **WHEN** the user has both "action" and "romance" chips active
- **THEN** the feed SHALL show posts tagged with either tag
- **AND** the URL SHALL contain `tags=action,romance`

### Requirement: Realm management page extends with tagTree editor

`/realm/:realmId/manage` SHALL include a tagTree editor section accessible to users with realm role admin or above (or global admin/root). The editor SHALL allow:

- adding leaf nodes by searching the global tag pool and picking a tag,
- adding header nodes (with `disabled: true` and a `label`),
- removing nodes,
- reordering nodes (drag or arrow controls),
- toggling `disabled` on nodes that have it.

Saving SHALL invoke `PUT /realms/:realmId/extra/tagTree` with the resulting array. The editor MAY ship with a flat-list-with-one-level-of-nesting MVP; full arbitrary-depth tree editing is a follow-up enhancement.

#### Scenario: Admin adds a tag to tagTree

- **GIVEN** an admin user on `/realm/realm-1/manage`
- **WHEN** the admin searches for "fantasy" in the tagTree editor and selects the resulting tag
- **THEN** a new node `{ tagId: "fantasy" }` SHALL be appended to the local tree state
- **AND** clicking Save SHALL call `PUT /realms/realm-1/extra/tagTree` with the updated array

#### Scenario: Admin adds a header

- **WHEN** the admin clicks "Add header" and enters label "Demographic"
- **THEN** a node `{ disabled: true, label: "Demographic" }` SHALL be added
- **AND** Save SHALL persist it

#### Scenario: Reorder updates tree

- **WHEN** the admin reorders nodes via drag
- **THEN** the local tree state SHALL reflect the new order
- **AND** Save SHALL persist the reordered array

### Requirement: Realm management page extends with rule/about/banner slot pickers

`/realm/:realmId/manage` SHALL include three slot pickers, one each for `rule`, `about`, and `banner`. Each picker SHALL allow:

- searching for a Post within or outside the realm by title,
- selecting an existing Post by id,
- clearing the slot.

For `banner`, the picker SHALL additionally allow entering a direct URL (which sets `banner.kind = "url"`). Saving SHALL invoke `PUT /realms/:realmId/extra/:key` with the appropriate value, or `DELETE /realms/:realmId/extra/:key` for clearing.

#### Scenario: Admin sets the rule slot

- **WHEN** the admin searches for a rule Post by title in the rule picker, selects it, and saves
- **THEN** `PUT /realms/realm-1/extra/rule` SHALL be called with the selected unit id

#### Scenario: Admin clears the about slot

- **WHEN** the admin clicks Clear on the about picker and saves
- **THEN** `DELETE /realms/realm-1/extra/about` SHALL be called

#### Scenario: Admin enters a banner URL

- **WHEN** the admin enters `/banners/cover.jpg` in the banner picker URL field and saves
- **THEN** `PUT /realms/realm-1/extra/banner` SHALL be called with `{ kind: "url", url: "/banners/cover.jpg" }`

### Requirement: Realm detail includes Wiki tab
The realm detail page SHALL include a Wiki tab when wiki functionality is enabled for the realm product surface. The Wiki tab SHALL use the uniform app theme and SHALL list WIKI Post Units sent to the realm through UnitRealm.

#### Scenario: Viewer opens realm Wiki tab
- **WHEN** a viewer opens the Wiki tab for realm `realm-fate`
- **THEN** the app SHALL render a list/search surface for WIKI Post Units in that realm

### Requirement: Realm Wiki tab exposes Zone entry
When a realm has a configured wiki Zone, the Wiki tab SHALL show a prominent action at the top of the tab that opens the themed Zone page. The action label SHALL be localized.

#### Scenario: Open wiki Zone from tab
- **GIVEN** realm `realm-fate` has wiki Zone `zone-fate-wiki`
- **WHEN** a viewer clicks the Wiki tab's Zone entry action
- **THEN** the app SHALL navigate to the Zone page for `zone-fate-wiki`

### Requirement: Realm Wiki tab does not apply Zone theme
The realm Wiki tab SHALL not apply Zone-specific theme tokens. Theme customization SHALL begin only on the Zone route.

#### Scenario: Theme not applied in tab
- **GIVEN** the realm's wiki Zone uses a custom background image
- **WHEN** a viewer opens the realm Wiki tab
- **THEN** the background image SHALL NOT be applied to the realm page

### Requirement: Realm detail exposes mature community tabs

The realm detail page SHALL expose community tabs for feed, tags, members, about, and moderator-only moderation entry when policy allows. The feed tab SHALL be the default entry and SHALL include the pinboard carousel, required rules/update prompts, feed controls, and the discussion stream where available. The about tab SHALL include rules/about, community stats, join policy, and moderator notices where available.

#### Scenario: Moderator sees moderation entry

- **WHEN** a realm moderator opens the realm detail page
- **THEN** the UI SHALL show a Moderation tab or entry for that realm
- **AND** regular members SHALL NOT see that entry

#### Scenario: Visitor opens realm feed

- **WHEN** a visitor opens a realm detail page
- **THEN** the initial tab SHALL present the realm feed
- **AND** the feed SHALL include the pinboard carousel when pinned Units exist
- **AND** the feed SHALL show a required rule or rule-update prompt when the viewer must acknowledge rules before participating

### Requirement: Realm page may use a desktop summary sidebar

Realm detail tabs MAY render a desktop right sidebar for persistent community summary content, but rules/about SHALL remain available in the about tab and rule prompts SHALL remain available from the feed when required. Mobile layouts SHALL render the same content inline without relying on a sidebar.

#### Scenario: Feed page keeps rule summary visible on desktop

- **WHEN** a desktop user opens the feed tab
- **THEN** the page MAY show rule/about/join summary in a right sidebar
- **AND** the about tab SHALL still contain the full rule/about entry points

### Requirement: Pinboard renders as a carousel rail

The public realm pinboard SHALL render as a horizontal carousel or rail using the existing Rezics carousel primitives on the default feed tab. Pinboard cards SHALL support fixed card dimensions, clamped titles, optional cover imagery, author/avatar metadata when available, and stable empty/loading/error states.

#### Scenario: Realm has pinned posts

- **GIVEN** a realm has four visible Unit ids in `Realm.extra.pinboard`
- **WHEN** the feed tab renders
- **THEN** the UI SHALL show a named Pinboard section
- **AND** pinned entries SHALL appear in a horizontal carousel/rail rather than a vertical list

### Requirement: Realm manage route expands beyond metadata

Realm management routes SHALL support rules, members, moderation, pins, tag curation, settings, and ownership flows rather than only metadata editing.

#### Scenario: Admin manages members

- **WHEN** a realm admin opens the members management section
- **THEN** they SHALL be able to filter members by role/state and perform policy-allowed role or state changes
