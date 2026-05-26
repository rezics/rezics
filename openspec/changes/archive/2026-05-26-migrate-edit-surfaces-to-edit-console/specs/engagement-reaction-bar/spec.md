## ADDED Requirements

### Requirement: ReactionBar overflow supports section-owned edit actions

The ReactionBar overflow menu SHALL allow owning sections to render additional
localized row actions such as edit without making the global engagement action
token list responsible for content authorization. Section-owned overflow
content SHALL stop row click propagation and remain keyboard accessible.

#### Scenario: Post tree section injects edit overflow item

- **WHEN** `PostTreeSection` renders a reply row that the viewer can edit
- **THEN** it SHALL be able to inject a localized edit menu item into that row's
  ReactionBar overflow
- **AND** selecting the item SHALL call the section-owned edit handler

#### Scenario: Overflow remains hidden when no item is available

- **WHEN** a ReactionBar has no hidden action tokens and no section-owned
  overflow content
- **THEN** it SHALL NOT render the more-actions trigger
