## ADDED Requirements

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

## MODIFIED Requirements

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
