## ADDED Requirements

### Requirement: Link builders prefer short-prefix slug URLs when slug is known

UI link builders that produce hrefs to slug-bearing Unit types (USER, REALM, TAG, ZONE, ENTITY, and owner-scoped SHELF) SHALL render the short-prefix slug URL whenever the target unit carries a slug, and SHALL fall back to the long-prefix unitId URL when the slug is absent. Link builders SHALL NOT render the long-prefix unitId URL when a slug is known.

This rule applies to every link-build site in the application — including profile menus, author bylines, tag chips, realm cards, entity references, hover previews, navigation tabs, search-result links, and post/comment/excerpt embeds. It does not apply to viewer-relative shorthand routes under `/user/me/*`, which are owner-bound surfaces (settings, edit-self, private bookmarks/follows/reactions) and continue to be linked by their `/user/me/...` path.

The application SHALL provide a single sanctioned helper for computing these hrefs (signature: `unitHref({ type, unitId, slug })` with a SHELF variant taking owner context). Link-building call sites SHALL route through this helper rather than constructing paths inline.

#### Scenario: Linking to a user with a slug

- **WHEN** a component builds an href to a USER unit whose DTO carries `slug = "alice"` and `unitId = "u-1"`
- **THEN** the helper SHALL return `/u/alice`
- **AND** the rendered `<Link>` SHALL navigate to the short-prefix slug route

#### Scenario: Linking to a user without a slug

- **WHEN** a component builds an href to a USER unit whose DTO carries `slug = null` and `unitId = "u-1"`
- **THEN** the helper SHALL return `/user/u-1`
- **AND** the rendered `<Link>` SHALL navigate to the long-prefix unitId route

#### Scenario: Header AccountMenu profile entry resolves slug-first

- **GIVEN** a viewer whose USER unit has `slug = "alice"`
- **WHEN** the header AccountMenu renders the profile menu item
- **THEN** the menu item's href SHALL be `/u/alice`
- **AND** the address bar after click SHALL show `/u/alice`, not `/user/<uuid>`

#### Scenario: Header AccountMenu profile entry falls back when no slug

- **GIVEN** a viewer whose USER unit has `slug = null` and `unitId = "u-9"`
- **WHEN** the header AccountMenu renders the profile menu item
- **THEN** the menu item's href SHALL be `/user/u-9`

#### Scenario: Linking to a system shelf under a slugged user

- **WHEN** a component builds an href to a SHELF unit with `slug = "favorites"`, `unitId = "s-7"`, owned by a USER unit with `slug = "alice"` and `unitId = "u-1"`
- **THEN** the helper SHALL return `/u/alice/shelf/favorites`

#### Scenario: Linking to a shelf whose owner has no slug

- **WHEN** a component builds an href to a SHELF unit with `slug = null`, `unitId = "s-7"`, owned by a USER unit with `slug = null` and `unitId = "u-1"`
- **THEN** the helper SHALL return `/shelf/s-7`

#### Scenario: Viewer-relative settings routes remain on `/user/me/*`

- **WHEN** the header AccountMenu renders the settings menu item
- **THEN** the menu item's href SHALL be `/user/me/setting/profile`
- **AND** the helper SHALL NOT be used for this destination (settings is viewer-relative, not a public profile link)

#### Scenario: Long-prefix UUID URL is never rendered when a slug is known

- **GIVEN** a TAG DTO with `slug = "sci-fi"` and `unitId = "t-3"`
- **WHEN** any link-build site references that tag
- **THEN** the rendered href SHALL be `/t/sci-fi`
- **AND** the rendered href SHALL NOT be `/tag/t-3`

### Requirement: Data queries prefer unitId-keyed endpoints

When the application has access to a unit's `unitId`, downstream data queries SHALL use unitId-keyed endpoints (`byId(unitId)`-style query options) rather than re-resolving the slug. Slug-resolution endpoints (`/slug/resolve`, `/user/by-slug`, `/realm/by-slug`, `/tag/by-slug`, `/zone/by-slug`, `/entity/by-slug`, `/shelf/by-slug`) SHALL only be invoked when the caller starts from a slug without an accompanying unitId — typically a route loader translating a URL param into a resolved DTO.

Once a slug route loader has resolved a DTO, child routes and child components SHALL read the resolved `unitId` from the loader data (or its routed query cache) and SHALL NOT redundantly call a by-slug endpoint to obtain the same unitId.

#### Scenario: Slug route loader resolves once

- **WHEN** a viewer navigates to `/u/alice`
- **THEN** the route loader SHALL call `/user/by-slug/alice` to resolve the USER DTO
- **AND** child components rendering followers, shelves, posts, or other resources SHALL consume the resolved `unitId` from the loader DTO via unitId-keyed queries
- **AND** no child SHALL re-call `/user/by-slug/alice` or `/slug/resolve` for the same user

#### Scenario: unitId route uses unitId-keyed queries directly

- **WHEN** a viewer navigates to `/user/u-1`
- **THEN** all data queries on that page SHALL use unitId-keyed endpoints
- **AND** no slug-resolution endpoint SHALL be called

#### Scenario: A page holding a resolved DTO links onward to a sub-resource

- **GIVEN** a page that has resolved the USER DTO for "alice" (`unitId = "u-1"`, `slug = "alice"`)
- **WHEN** the page renders a link to alice's favorites shelf
- **THEN** the href SHALL be built via the link helper using both the slug and the unitId already in scope
- **AND** the page SHALL NOT additionally call any slug-resolution endpoint to construct that href
