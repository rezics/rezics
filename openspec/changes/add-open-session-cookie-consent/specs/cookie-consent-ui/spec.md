## ADDED Requirements

### Requirement: Package UI exports a reusable cookie consent component
`package/ui` SHALL export a reusable cookie consent component that host applications can render to present cookie-policy messaging, a link to the cookie policy, and an explicit consent action. The component SHALL be suitable for reuse across Rezics frontend packages without embedding app-specific routing or persistence requirements.

#### Scenario: Host renders consent prompt
- **WHEN** a consuming app renders the cookie consent component with visible state enabled
- **THEN** the component SHALL display explanatory copy about cookie usage
- **AND** the component SHALL render a control that lets the user explicitly accept the policy
- **AND** the component SHALL render a link or action target for reviewing the cookie policy

#### Scenario: Host handles acceptance
- **WHEN** the user activates the consent acceptance control
- **THEN** the component SHALL invoke a host-provided handler so the consuming app can persist consent

### Requirement: Cookie consent component supports accessible and localizable composition
The cookie consent component SHALL accept configurable text and labels so consuming apps can localize the prompt, and it SHALL preserve keyboard and screen-reader usability.

#### Scenario: Localized copy is supplied by host
- **WHEN** a consuming app provides translated title, body, and action labels
- **THEN** the component SHALL render the supplied copy without hard-coded English strings being required

#### Scenario: Keyboard user can complete consent
- **WHEN** a keyboard-only user reaches the cookie consent component
- **THEN** all interactive controls SHALL be focusable
- **AND** the user SHALL be able to activate the primary consent action without a pointer device

### Requirement: Cookie consent component supports dismissal without hiding policy access
The cookie consent component SHALL allow hosts to offer a secondary dismiss or postpone action when desired, while keeping the cookie-policy destination available whenever the prompt is visible.

#### Scenario: Optional secondary action is rendered
- **WHEN** a consuming app supplies a secondary action for dismissing or postponing the prompt
- **THEN** the component SHALL render that action alongside the primary consent control

#### Scenario: Policy link remains visible
- **WHEN** the cookie consent component is visible
- **THEN** the cookie-policy link or equivalent review action SHALL remain available regardless of whether a secondary action is configured
