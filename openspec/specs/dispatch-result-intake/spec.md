## ADDED Requirements

### Requirement: Workers can submit task results via API token

The server SHALL expose `POST /dispatch/results` that accepts an API token via the `Authorization` header. The endpoint SHALL authenticate the token using `tokenService.authenticateFromHeader()` and verify the token has the `dispatch` scope with appropriate permissions (`unit:update` for updates, `unit:create` for creates).

#### Scenario: Successful result submission with unitId (update)

- **WHEN** a valid API token with `dispatch: ["unit:update"]` scope submits a result payload with a `unitId` to `POST /dispatch/results`
- **THEN** the server validates the payload, upserts the data into the corresponding entity table via Prisma, and returns status 200

#### Scenario: Successful result submission without unitId (create)

- **WHEN** a valid API token with `dispatch: ["unit:create"]` scope submits a result payload without a `unitId` to `POST /dispatch/results`
- **THEN** the server validates the payload, creates a new entity record via Prisma, and returns status 200 with the new `unitId`

#### Scenario: Create attempt without create permission

- **WHEN** a valid API token with `dispatch: ["unit:update"]` but without `unit:create` submits a result payload without a `unitId`
- **THEN** the server returns status 403 indicating the token lacks create permission

#### Scenario: Invalid or missing API token

- **WHEN** an invalid, expired, revoked, or missing API token is presented to `POST /dispatch/results`
- **THEN** the server returns status 401

### Requirement: Result payload uses type discriminant for entity routing

The result payload SHALL contain a `type` field with values `rezics:book`, `rezics:game`, or `rezics:media`. The server SHALL use this field to determine which Prisma model and processing logic to apply. The `data` field SHALL contain a partial JSON object whose keys map to database fields for that entity type.

#### Scenario: Book result is routed to book processing

- **WHEN** a result with `type: "rezics:book"` is submitted
- **THEN** the server validates `data` against the book schema and upserts into the book table

#### Scenario: Game result is routed to game processing

- **WHEN** a result with `type: "rezics:game"` is submitted
- **THEN** the server validates `data` against the game schema and upserts into the game table

#### Scenario: Media result is routed to media processing

- **WHEN** a result with `type: "rezics:media"` is submitted
- **THEN** the server validates `data` against the media schema and upserts into the media table

#### Scenario: Unknown type is rejected

- **WHEN** a result with an unrecognized `type` value is submitted
- **THEN** the server returns status 400 indicating an invalid dispatch type

### Requirement: Server notifies hub after processing results

After successfully processing a result, the server SHALL send an HMAC-SHA256 signed audit notification to the dispatch hub at `POST <DISPATCH_HUB_URL>/tasks/audit`. The notification SHALL contain `{ taskIds, project, signature }` where the signature is computed over sorted `taskIds` concatenated with `project`, using `DISPATCH_RECEIPT_SECRET`.

#### Scenario: Hub receives audit notification on success

- **WHEN** a result is successfully processed and stored
- **THEN** the server sends `POST <DISPATCH_HUB_URL>/tasks/audit` with the taskId, project, and HMAC-SHA256 signature

#### Scenario: Hub notification retries on failure

- **WHEN** the hub audit notification fails (network error or non-2xx response)
- **THEN** the server retries up to 3 times with exponential backoff (1s, 2s, 4s)

#### Scenario: Hub notification exhausts retries

- **WHEN** all 3 retry attempts for the hub audit notification fail
- **THEN** the server logs the failure and returns success to the worker (the result data is already stored; the hub will reassign the task if needed)

### Requirement: Dispatch configuration via environment variables

The server SHALL read dispatch hub configuration from environment variables: `DISPATCH_HUB_URL` (hub base URL), `DISPATCH_RECEIPT_SECRET` (HMAC shared secret), `DISPATCH_PROJECT_ID` (project identifier). These SHALL be validated at startup using the existing env validation pattern (`@t3-oss/env-core`).

#### Scenario: Server starts with valid dispatch config

- **WHEN** all dispatch environment variables are set
- **THEN** the server starts successfully and the dispatch endpoints are available

#### Scenario: Server starts without dispatch config

- **WHEN** dispatch environment variables are missing
- **THEN** the dispatch results endpoint SHALL be unavailable (returns 503), but the rest of the server starts normally. The token session endpoint SHALL remain available (it does not depend on hub config).
