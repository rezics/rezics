# settings-profile Specification

## Purpose

Defines the Profile section of user settings: editable display
name, plain-text bio, markdown-edited description (via
`RezicsMarkdownEditor`), avatar URL with live preview, and a
read-only `@slug` field. Persistence goes through
`userApi.updateMe()` with success / loading / error feedback on the
save action.

## Requirements

### Requirement: Edit display name
The Profile section SHALL provide a text input for the user's display name. Changes SHALL be saved via `userApi.updateMe()`.

#### Scenario: Update name
- **WHEN** the user changes their name and clicks Save
- **THEN** the name is updated via the API and a success message is shown

### Requirement: Edit bio and description
The Profile section SHALL provide multiline text inputs for bio (short) and description (long). Changes SHALL be saved via `userApi.updateMe()`.

#### Scenario: Update bio
- **WHEN** the user edits their bio and saves
- **THEN** the bio is updated and the profile page reflects the change

### Requirement: Edit avatar URL
The Profile section SHALL provide a text input for the avatar URL with a live preview of the avatar image next to the input.

#### Scenario: Avatar preview updates
- **WHEN** the user types a new URL in the avatar field
- **THEN** a preview image updates in real-time to show the new avatar

### Requirement: Display slug as read-only
The Profile section SHALL display the user's slug (@username) as a read-only field. The slug is set during registration and cannot be changed from settings.

#### Scenario: Slug is visible but not editable
- **WHEN** the Profile section loads
- **THEN** the slug is displayed with a read-only indicator

### Requirement: Save with loading and feedback
The Profile section save action SHALL show a loading indicator while the API call is in progress. On success, a success message SHALL be displayed. On error, the error message SHALL be shown.

#### Scenario: Save succeeds
- **WHEN** the user saves profile changes and the API responds successfully
- **THEN** a success message "Profile updated" is displayed

#### Scenario: Save fails
- **WHEN** the user saves profile changes and the API returns an error
- **THEN** the error message is displayed to the user

### Requirement: Edit bio and description (markdown)
The Profile section SHALL provide a multiline text input for bio (short, plain text). The description field SHALL use `RezicsMarkdownEditor` for rich markdown editing. Changes SHALL be saved via `userApi.updateMe()`.

#### Scenario: Update bio with markdown editor
- **WHEN** the user edits their bio and saves
- **THEN** the bio is updated and the profile page reflects the change

#### Scenario: Update description with markdown
- **WHEN** the user edits their description using the markdown editor and saves
- **THEN** the markdown source text is stored and the profile Overview tab renders it as formatted content
