## ADDED Requirements

### Requirement: Description edited as markdown
The user description field in the settings profile section SHALL use `RezicsMarkdownEditor` instead of a plain text input. The editor SHALL output markdown source text stored in `User.description`.

#### Scenario: User edits description with formatting
- **WHEN** the user opens the profile settings page
- **THEN** the description field renders as a `RezicsMarkdownEditor` with the current description content loaded

#### Scenario: User saves markdown description
- **WHEN** the user writes markdown (headings, lists, bold, code) in the description editor and saves
- **THEN** the markdown source text is stored in the `description` field via `userApi.updateMe()`

### Requirement: Profile Overview renders DESCRIPTION.md box
The profile Overview tab's main column SHALL render the user's description as markdown inside a bordered container. The container SHALL display a label "DESCRIPTION.md" in the top-left corner. The box SHALL appear above the Pinned section.

#### Scenario: Description renders as markdown
- **WHEN** a user with a description is viewed on the Overview tab
- **THEN** the description is rendered via `MarkdownContent` inside a bordered box with "DESCRIPTION.md" label, styled with `github-markdown-css`

#### Scenario: No description hides the box
- **WHEN** a user has no description (null or empty string)
- **THEN** the DESCRIPTION.md box is not rendered

#### Scenario: Box position in layout
- **WHEN** the Overview tab loads for a user with a description
- **THEN** the DESCRIPTION.md box appears above the Pinned section in the main column

### Requirement: Bio remains plain text
The `bio` field SHALL NOT be affected by markdown changes. It remains a plain text one-liner used in cards and compact contexts.

#### Scenario: Bio is not rendered as markdown
- **WHEN** `user.bio` is displayed in any context (profile header, user card, brief)
- **THEN** it is rendered as plain text, not processed through the markdown renderer
