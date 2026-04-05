## ADDED Requirements

### Requirement: Source-line attribute injection

The markdown-it rendering pipeline SHALL inject `data-source-line` attributes on block-level HTML elements. The attribute value SHALL be the 0-based starting source line number from the token's `token.map[0]` metadata.

The injection SHALL be implemented as a composable markdown-it plugin (`sourceLinePlugin`) that can be used independently of scroll sync.

#### Scenario: Paragraph receives source-line attribute

- **WHEN** a markdown paragraph starting at source line 5 is rendered
- **THEN** the output `<p>` tag SHALL include `data-source-line="5"`

#### Scenario: Heading receives source-line attribute

- **WHEN** a heading starting at source line 12 is rendered
- **THEN** the output heading tag SHALL include `data-source-line="12"`

#### Scenario: Tokens without map are unaffected

- **WHEN** a token has no `map` metadata (e.g., inline tokens)
- **THEN** no `data-source-line` attribute SHALL be injected

#### Scenario: Plugin composes with existing plugins

- **WHEN** `sourceLinePlugin` is used alongside `novelModePlugin`
- **THEN** both plugins SHALL produce their respective output without conflict
