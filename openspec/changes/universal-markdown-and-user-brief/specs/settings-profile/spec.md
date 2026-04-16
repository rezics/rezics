## MODIFIED Requirements

### Requirement: Edit bio and description
The Profile section SHALL provide a multiline text input for bio (short, plain text). The description field SHALL use `RezicsMarkdownEditor` for rich markdown editing. Changes SHALL be saved via `userApi.updateMe()`.

#### Scenario: Update bio
- **WHEN** the user edits their bio and saves
- **THEN** the bio is updated and the profile page reflects the change

#### Scenario: Update description with markdown
- **WHEN** the user edits their description using the markdown editor and saves
- **THEN** the markdown source text is stored and the profile Overview tab renders it as formatted content
