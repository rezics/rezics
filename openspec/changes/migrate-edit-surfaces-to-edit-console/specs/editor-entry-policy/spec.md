## ADDED Requirements

### Requirement: Editor entry is separate from field edit permission

The app SHALL distinguish editor entry permission from concrete field or
operation edit permission. An editor entry decision SHALL determine whether the
viewer can see or enter an editor surface. Field-level edit permission SHALL
still be enforced by the specific form, mutation, server permission helper,
collaborative authority gate, and field-lock checks.

#### Scenario: Locked field does not hide editor entry

- **WHEN** an authenticated non-blocked viewer opens a collaborative Book,
  future Game, or Wiki Post surface where ordinary content fields are locked
- **THEN** the app SHALL still be allowed to render the focal editor entry when
  at least one editor capability such as tag editing can apply
- **AND** locked fields SHALL render as unavailable or fail safely through the
  existing field-lock flow

#### Scenario: Editor entry does not authorize mutation

- **WHEN** a viewer enters an editor surface through an editor entry icon
- **THEN** each save action SHALL still be authorized by the target mutation and
  server-side permission checks
- **AND** entering the editor SHALL NOT bypass ownership, collaborator role,
  field-lock, or blocked-user checks

### Requirement: Collaborative surfaces expose editor entry by capability

The app SHALL compute editor entry for collaborative work surfaces such as
Book, future Game/Media work surfaces, and Wiki Post from whether the viewer
can perform any editor capability on the surface, not from whether the viewer
can edit every field. Authenticated non-blocked viewers can enter these
editors when community, collaborator, owner, admin, tag, or externally governed
operations are available.

#### Scenario: Authenticated viewer sees collaborative editor entry

- **WHEN** an authenticated non-blocked viewer opens a Book detail page
- **THEN** the page SHALL render the focal editor entry if the editor exposes at
  least one available capability for that viewer
- **AND** unavailable fields inside the editor SHALL remain disabled, locked, or
  rejected according to their own authorization path

#### Scenario: Anonymous viewer does not get content editor entry

- **WHEN** an anonymous viewer opens a collaborative content detail page
- **THEN** the page SHALL NOT render the content editor entry as an available
  action
- **AND** the absence of the editor entry SHALL NOT affect public read access

#### Scenario: Blocked viewer does not get editor entry

- **WHEN** a blocked viewer opens any content detail page
- **THEN** the page SHALL NOT render an editor entry

### Requirement: Author-owned surfaces remain owner controlled

The app SHALL render editor entry for ordinary author-owned surfaces such as
ordinary Review, Remark, Excerpt, and reply Post only for the owner,
admin/root, or another actor explicitly authorized for that surface. These
surfaces SHALL NOT use broad collaborative entry merely because the content is
represented as a Post.

#### Scenario: Non-owner cannot enter ordinary post editor

- **WHEN** user B opens an ordinary Review authored by user A
- **THEN** user B SHALL NOT see the focal editor entry unless user B is
  otherwise authorized by the surface

#### Scenario: Owner can enter ordinary post editor

- **WHEN** user A opens their own ordinary Review, Remark, Excerpt, or reply
  Post
- **THEN** the app SHALL render the appropriate editor entry for that surface
