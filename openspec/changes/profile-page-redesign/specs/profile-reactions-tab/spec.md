## ADDED Requirements

### Requirement: Reactions tab placeholder
The Reactions tab SHALL render a placeholder UI indicating that reaction history is coming soon. The placeholder SHALL follow the MOCK convention with `// MOCK:` annotations in the source code.

#### Scenario: Placeholder renders
- **WHEN** a user navigates to the Reactions tab
- **THEN** a message "Reaction history is coming soon" is displayed with a visual placeholder

### Requirement: Future L2 structure
The Reactions tab placeholder SHALL include inactive (disabled) L2 chips for "Given" and "Received" to communicate the intended future structure. These chips SHALL be non-interactive.

#### Scenario: Disabled chips visible
- **WHEN** the Reactions tab loads
- **THEN** "Given" and "Received" chips are visible but disabled/grayed out
