## ADDED Requirements

### Requirement: DESCRIPTION.md box in main column
The Overview tab's main column SHALL render a DESCRIPTION.md box above the Pinned section when the user has a description. The box SHALL have a bordered container with a "DESCRIPTION.md" label in the top-left corner. The content SHALL be rendered as markdown via `MarkdownContent`.

#### Scenario: Description box renders above pinned
- **WHEN** the Overview tab loads for a user with a non-empty description
- **THEN** a bordered box labeled "DESCRIPTION.md" appears above the Pinned section, containing the rendered markdown

#### Scenario: No description skips the box
- **WHEN** the Overview tab loads for a user with no description
- **THEN** the DESCRIPTION.md box is not rendered; Pinned is the first main column item

#### Scenario: Markdown styling
- **WHEN** the description contains markdown syntax
- **THEN** it is rendered with `github-markdown-css` styling inside the box
