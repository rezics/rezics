# settings-connections Specification

## Purpose

Defines the Connected Accounts section of user settings: it lists
the five supported OAuth providers (Google, GitHub, Microsoft,
Twitter, Telegram), reflects the current connection state from
`authSessionState.providerIds`, marks the primary provider, drives
new connections through `authApi.signInSocial()`, and hides
disconnect controls until the backend supports unlinking.

## Requirements

### Requirement: Display connected OAuth providers
The Connected Accounts section SHALL display all supported OAuth providers (Google, GitHub, Microsoft, Twitter, Telegram) with their connection status. Connected providers SHALL show a "Connected" badge. Unconnected providers SHALL show a "Connect" button.

#### Scenario: Provider list renders
- **WHEN** the Connected Accounts section loads
- **THEN** all 5 providers are listed, each showing its icon/name and connection status derived from `authSessionState.providerIds`

### Requirement: Connect a provider
Clicking "Connect" on an unconnected provider SHALL initiate the OAuth flow via `authApi.signInSocial()`, which redirects the user to the provider's authorization page. After completing authorization, the page SHALL refresh to reflect the newly connected provider.

#### Scenario: Connect Google account
- **WHEN** the user clicks "Connect" on Google
- **THEN** the user is redirected to Google OAuth, and upon return the Google provider shows as "Connected"

### Requirement: Primary provider display
If the user has a primary provider (from `authSessionState.primaryProviderId`), it SHALL be indicated with a "Primary" label.

#### Scenario: Primary provider marked
- **WHEN** the user's primary provider is Google
- **THEN** the Google entry shows both "Connected" and "Primary" labels

### Requirement: Disconnect not yet available
Provider disconnection is not supported by the backend. The section SHALL NOT show disconnect buttons. A note MAY be displayed stating that provider unlinking is not yet available.

#### Scenario: No disconnect option
- **WHEN** the Connected Accounts section renders
- **THEN** no "Disconnect" buttons are shown for connected providers
