## ADDED Requirements

### Requirement: Focal post edit uses visible editor entry

Focal post detail surfaces SHALL render edit affordances as visible editor
icons in a page-owned action area when the viewer can enter the editor. This
includes Review, Remark, Excerpt-as-focal-content where applicable, generic
root Post detail, Wiki Post detail, and continue-thread focal post surfaces.

#### Scenario: Owner sees focal post editor icon

- **WHEN** the owner opens a Review, Remark, or focal Post detail page
- **THEN** the page SHALL render a visible localized editor icon action
- **AND** activating the action SHALL navigate to that focal surface's editor
  route

#### Scenario: Presentation component stays authorization-free

- **WHEN** a developer inspects post presentation components such as
  `PostCard`, `PostReply`, `ReviewDetail`, or `RemarkDetail`
- **THEN** those components SHALL NOT own edit authorization checks
- **AND** focal edit affordances SHALL be owned by the route, page, or section
  that composes the presentation component

### Requirement: Post tree node edit uses inline overflow entry

Non-current post tree nodes SHALL NOT navigate to the editor layout for editing.
When a viewer can edit such a node, the tree section SHALL expose the edit
action inside the row ReactionBar overflow menu and open an inline editor or
dialog for that node.

#### Scenario: Tree reply owner edits from overflow

- **WHEN** the owner of a reply views that reply inside a `PostTreeSection`
- **THEN** the row's ReactionBar overflow menu SHALL include a localized edit
  action
- **AND** selecting the action SHALL open an inline editor or dialog for that
  reply without navigating away from the current thread URL

#### Scenario: Unauthorized tree reply hides edit overflow item

- **WHEN** a viewer who cannot edit a reply opens that reply row's ReactionBar
  overflow menu
- **THEN** the overflow menu SHALL NOT include the edit action for that reply

### Requirement: Post metadata indicates edited content

Post metadata SHALL render a localized edited marker when a post has both
`createdAt` and `updatedAt` timestamps and the normalized timestamps differ.

#### Scenario: Edited post shows marker

- **WHEN** a Post DTO has `createdAt` and `updatedAt` values that represent
  different instants
- **THEN** post metadata SHALL render a localized "edited" marker near the post
  date

#### Scenario: Unedited post hides marker

- **WHEN** a Post DTO has matching `createdAt` and `updatedAt` values
- **THEN** post metadata SHALL NOT render the edited marker
