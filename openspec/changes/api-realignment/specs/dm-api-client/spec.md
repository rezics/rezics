## ADDED Requirements

### Requirement: DM send API client
The `@rezics/api` package SHALL provide a `dmApi` object with a method that maps to the server's `POST /dm/send` endpoint. Types SHALL be imported from `@rezics/contract`.

Methods:
- `send(input: DmSendBody): Promise<{ success: true }>` — `POST /dm/send`

#### Scenario: Send a direct message
- **WHEN** `dmApi.send({ recipientId: "user-2", content: "Hello" })` is called
- **THEN** it SHALL send `POST /dm/send` with the input as JSON body and return `{ success: true }`

#### Scenario: Server rejects self-message
- **WHEN** the server returns 400 (sending to self)
- **THEN** the promise SHALL reject with the error from `apiFetch`

#### Scenario: Server rejects non-follower
- **WHEN** the server returns 403 (sender doesn't follow recipient)
- **THEN** the promise SHALL reject with the error from `apiFetch`

### Requirement: DM query key factory
The module SHALL export a `dmKeys` factory. Since DM currently only has a send operation, the keys SHALL include a base key and a conversations key for future expansion.

#### Scenario: Base key
- **WHEN** `dmKeys.all()` is called
- **THEN** it SHALL return `["dm"]`

### Requirement: DM mutation hook
The module SHALL export a `useSendDmMutation` hook.

#### Scenario: Send mutation
- **WHEN** `useSendDmMutation` is used and called with `{ recipientId: "user-2", content: "Hello" }`
- **THEN** it SHALL call `dmApi.send(input)` and return the result

### Requirement: DM barrel export
The module SHALL export all public API surface from a `dm.ts` barrel file.

#### Scenario: Single import point
- **WHEN** a consumer imports from `@rezics/api/dm/dm`
- **THEN** they SHALL have access to `dmApi`, `dmKeys`, `useSendDmMutation`, `dmMutations`, and re-exported types (`DmSendBody`)
