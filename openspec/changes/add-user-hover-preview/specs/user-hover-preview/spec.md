## ADDED Requirements

### Requirement: User identity affordances expose a hover preview

User identity affordances that include a public avatar or username SHALL be able to render a profile preview when the avatar or username is hovered by a pointer or focused by keyboard. The preview SHALL be progressive enhancement; the user's profile link SHALL remain usable even when the preview is unavailable or not opened.

#### Scenario: Avatar hover opens preview

- **WHEN** a pointer hovers a user's avatar in a supported user identity affordance
- **THEN** a profile preview popover SHALL open for that user
- **AND** clicking the avatar SHALL navigate to that user's profile route

#### Scenario: Username hover opens preview with underline

- **WHEN** a pointer hovers a user's displayed username in a supported user identity affordance
- **THEN** the username SHALL render a URL-style underline
- **AND** a profile preview popover SHALL open for that user
- **AND** clicking the username SHALL navigate to that user's profile route

#### Scenario: Keyboard focus opens preview

- **WHEN** keyboard focus moves to the avatar link or username link
- **THEN** the profile preview popover SHALL open for that user
- **AND** the focused link SHALL remain keyboard-activatable as a profile navigation target

#### Scenario: Anonymous or missing user does not open preview

- **WHEN** a post or unit has no usable public user identifier
- **THEN** the identity affordance SHALL render a non-preview anonymous fallback
- **AND** it SHALL NOT render a broken profile link

### Requirement: Preview content summarizes public profile data

The user hover preview SHALL render a compact public profile summary from the user data supplied by its caller. It SHALL include the user's avatar fallback, display name, slug when available, bio or description when available, and follower/following counts when available. Optional fields that are absent SHALL be omitted rather than replaced with misleading placeholder data.

#### Scenario: Full user data renders profile summary

- **WHEN** the preview receives a user with name, slug, avatar, bio, followers count, and followings count
- **THEN** the preview SHALL display those public fields in a compact profile summary
- **AND** the avatar SHALL include an `AvatarFallback`

#### Scenario: Optional text fields are missing

- **WHEN** the preview receives a user without bio or description
- **THEN** the preview SHALL omit the bio or description region
- **AND** the preview SHALL still display the user's name/avatar identity

#### Scenario: Counts are missing

- **WHEN** the preview receives a user without follower or following counts
- **THEN** the preview SHALL omit the missing count labels
- **AND** it SHALL NOT render fake zero counts unless the supplied value is explicitly `0`

#### Scenario: Long display data stays contained

- **WHEN** the preview receives a long username, slug, bio, or description
- **THEN** the trigger and preview SHALL truncate or clamp the text so it does not overflow or overlap adjacent UI

### Requirement: Preview composition uses shadcn Base Popover

The hover preview SHALL be composed from the existing shadcn Base Popover exported by `@rezics/ui/shadcn`. The implementation SHALL NOT introduce a new third-party overlay dependency and SHALL NOT edit vendored shadcn primitive source under `package/ui/src/shadcn/` for this behavior.

#### Scenario: Component imports shadcn primitives through rezics UI

- **WHEN** the preview component source is inspected
- **THEN** Popover, Avatar, Button, Separator, Badge, or similar shadcn primitives SHALL be imported from `@rezics/ui/shadcn`
- **AND** the source SHALL NOT import overlay primitives directly from `@base-ui/react`

#### Scenario: Vendored Popover remains unmodified

- **WHEN** the change is complete
- **THEN** `package/ui/src/shadcn/popover.tsx` SHALL remain unchanged by the user hover preview implementation
- **AND** any domain-specific layout or styling SHALL live in rezics-authored app or composite code

#### Scenario: No new UI library dependency is added

- **WHEN** package manifests are inspected after implementation
- **THEN** no new third-party UI component library dependency SHALL be added for user hover previews

### Requirement: Preview styling follows rezics design tokens

The preview surface SHALL follow rezics design-system constraints. It SHALL use token-backed surfaces, text colors, borders, radius, and motion. It SHALL avoid raw hex colors, decorative gradients, oversized shadows, and social-media-specific chrome that conflicts with the rezics parchment/warm-stone visual language.

#### Scenario: Popover surface uses token classes

- **WHEN** the preview popover content source is inspected
- **THEN** its custom styling SHALL use token-backed classes such as surface, text, border, radius, and spacing utilities
- **AND** it SHALL NOT use raw hex color classes or inline hex color styles

#### Scenario: Popover avoids shadow-heavy card chrome

- **WHEN** the preview is rendered
- **THEN** the floating surface SHALL read as an elevated popover using a token-backed surface and whisper boundary
- **AND** it SHALL NOT render as a shadow-heavy card inside another card

#### Scenario: Light and dark themes both render readable content

- **WHEN** the preview is rendered in light mode and dark mode
- **THEN** avatar fallback, name, slug, bio or description, and counts SHALL remain readable against the preview surface

### Requirement: Presentation consumers remain data-driven

Post-kind presentation atoms that adopt user hover previews SHALL render from user data already present on their props. They SHALL NOT add lazy user fetching, profile query hooks, or mutation ownership as part of adopting the preview.

#### Scenario: PostAuthorHeader adopts preview without fetching

- **WHEN** `PostAuthorHeader` is updated to render the user hover preview
- **THEN** it SHALL pass the `PostDTO.author` or equivalent supplied public user data into the preview component
- **AND** it SHALL NOT call `useQuery`, `useMutation`, or a profile-fetching hook

#### Scenario: Follow action is not forced into pure presentation

- **WHEN** a presentation atom renders a user hover preview without owning authenticated interaction state
- **THEN** the preview MAY omit a follow action
- **AND** the absence of that action SHALL NOT block the identity preview behavior

### Requirement: Storybook covers interaction states

The change SHALL add or update Storybook stories that document the user hover preview behavior and its first consumer states.

#### Scenario: User hover preview stories exist

- **WHEN** Storybook stories for the user hover preview are inspected
- **THEN** they SHALL cover default data, missing optional profile fields, long display data, and compact trigger sizing

#### Scenario: PostAuthorHeader stories include preview-capable states

- **WHEN** `PostAuthorHeader` stories are inspected
- **THEN** default and compact states SHALL render the preview-capable avatar and username affordances
