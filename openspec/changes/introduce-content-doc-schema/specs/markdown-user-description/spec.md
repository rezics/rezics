## MODIFIED Requirements

### Requirement: Description edited as markdown
Long user or Unit descriptions that support rich formatting SHALL use `ContentDoc` instead of a plain description string. The settings profile description editor SHALL use `RezicsMarkdownEditor` and SHALL save Markdown source into the description content document's `main.source`. Compact `bio` and short summary fields SHALL remain plain strings.

#### Scenario: User edits description with formatting
- **WHEN** the user opens the profile settings page
- **THEN** the description field renders as a `RezicsMarkdownEditor` with the current description content loaded from the description `ContentDoc`

#### Scenario: User saves markdown description
- **WHEN** the user writes markdown in the description editor and saves
- **THEN** the markdown source text is stored in a description `ContentDoc`
- **AND** it SHALL NOT be stored as a plain PostgreSQL `descriptionText` projection

### Requirement: Profile Overview renders DESCRIPTION.md box
The profile Overview tab's main column SHALL render the user's description `ContentDoc` as markdown when `main.type = "markdown"`. The container SHALL display a label "DESCRIPTION.md" in the top-left corner. The box SHALL appear above the Pinned section.

#### Scenario: Description renders as markdown
- **WHEN** a user with a Markdown description content document is viewed on the Overview tab
- **THEN** the description is rendered via `MarkdownContent` inside a bordered box with "DESCRIPTION.md" label, styled with `github-markdown-css`

#### Scenario: No description hides the box
- **WHEN** a user has no description content document or an empty Markdown source
- **THEN** the DESCRIPTION.md box is not rendered

#### Scenario: Box position in layout
- **WHEN** the Overview tab loads for a user with a description
- **THEN** the DESCRIPTION.md box appears above the Pinned section in the main column

### Requirement: Bio remains plain text
The `bio` field SHALL NOT be affected by content document changes. It remains a plain text one-liner used in cards and compact contexts.

#### Scenario: Bio is not rendered as markdown
- **WHEN** `user.bio` is displayed in any context (profile header, user card, brief)
- **THEN** it is rendered as plain text, not processed through the markdown renderer
