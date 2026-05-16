## MODIFIED Requirements

### Requirement: WebSocket receive-only delivery

The system SHALL provide `WS /dm` for real-time message delivery. This channel is receive-only from the frontend's perspective — clients connect and receive incoming messages but do not send messages over the WebSocket. Authentication SHALL be performed via the `rezics-session-token` cookie sent on the WebSocket upgrade request (under `subdomain-trust-boundary`'s `Domain=.rezics.com` cookie scope). The legacy `?token=<jwt>` query parameter authentication path SHALL be removed.

#### Scenario: Recipient receives message in real-time

- **WHEN** user B has an active WebSocket connection
- **AND** a message from user A is persisted for their conversation
- **THEN** user B receives the message on their WebSocket connection

#### Scenario: WebSocket authentication via cookie on handshake

- **WHEN** a browser opens a WebSocket connection to `WS /dm` from a `*.rezics.com` origin (or `localhost` in dev) with the `rezics-session-token` cookie set
- **THEN** the browser includes the cookie on the upgrade request, notify verifies the JWT, and the connection is established

#### Scenario: Missing cookie closes connection

- **WHEN** a WebSocket upgrade request to `WS /dm` arrives with no `rezics-session-token` cookie
- **THEN** the connection is closed with code 4001

#### Scenario: Query-parameter token no longer accepted

- **WHEN** a WebSocket upgrade request to `WS /dm?token=<jwt>` arrives with a query parameter but no cookie
- **THEN** the connection is closed with code 4001 (the query parameter path is removed; query-param tokens land in access logs and HTTP referrers, removing them is a security improvement)
