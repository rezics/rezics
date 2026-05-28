# settings-tokens Specification

## Purpose

Defines the API Tokens section of user settings: lists non-revoked
tokens with name, scopes, creation/expiration/last-used/IP
metadata, drives token creation through `tokenApi.create()` with a
one-time raw-token display (copy button, no re-display), supports
metadata edits via `tokenApi.update()`, and revocation via
`tokenApi.revoke()` behind a confirmation dialog.

## Requirements

### Requirement: List API tokens
The Tokens section SHALL display all non-revoked API tokens from `tokenApi.list()`. Each token entry SHALL show: name, scopes (as chips), creation date, expiration date (or "No expiration"), last used date (or "Never used"), and last IP address.

#### Scenario: Token list renders
- **WHEN** the Tokens section loads
- **THEN** all non-revoked tokens are listed with their metadata

#### Scenario: No tokens
- **WHEN** the user has no API tokens
- **THEN** an empty state "No API tokens yet" is displayed with a "Generate new token" button

### Requirement: Create new token
The Tokens section SHALL provide a "Generate new token" button that opens a dialog/form. The form SHALL include: token name (required), scope checkboxes (`user:read`, `user:write`, `dispatch:rezics-server-session`), and optional expiration date picker. On submission, `tokenApi.create()` is called.

#### Scenario: Create token
- **WHEN** the user fills in name, selects scopes, and clicks Create
- **THEN** the token is created and the raw token string is displayed

### Requirement: One-time raw token display
After token creation, the raw token string SHALL be displayed in a highlighted, read-only field with a "Copy" button. A warning banner SHALL state "Make sure to copy your token now. You won't be able to see it again." The dialog SHALL NOT close until the user explicitly dismisses it.

#### Scenario: Copy token
- **WHEN** the user clicks the "Copy" button
- **THEN** the token is copied to the clipboard and the button shows a checkmark confirmation

#### Scenario: Token not shown again
- **WHEN** the user dismisses the creation dialog and revisits the token list
- **THEN** the raw token is no longer available — only the token metadata is shown

### Requirement: Edit token metadata
Each token in the list SHALL have an "Edit" action. Editing allows changing the token name, scopes, and expiration date via `tokenApi.update()`.

#### Scenario: Edit token name
- **WHEN** the user clicks Edit on a token, changes the name, and saves
- **THEN** the token name is updated via the API and reflected in the list

### Requirement: Revoke token
Each token SHALL have a "Revoke" button. Revoking SHALL call `tokenApi.revoke()` and remove the token from the list. A confirmation dialog SHALL be shown before revocation.

#### Scenario: Revoke token with confirmation
- **WHEN** the user clicks Revoke and confirms
- **THEN** the token is revoked and removed from the displayed list

#### Scenario: Cancel revocation
- **WHEN** the user clicks Revoke but cancels the confirmation
- **THEN** the token remains active
