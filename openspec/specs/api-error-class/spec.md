## ADDED Requirements

### Requirement: Typed ApiError class
`@rezics/api` SHALL export an `ApiError` class extending `Error` with typed fields: `status` (number), `code` (string), `message` (string), and optional `detail` (structured object matching the backend error response shape).

#### Scenario: Backend returns error response
- **WHEN** `apiFetchResponse` receives an HTTP response with `!response.ok`
- **THEN** it SHALL throw an `ApiError` instance with `status`, `code`, `message`, and `detail` extracted from the response JSON

#### Scenario: Backend returns non-JSON error
- **WHEN** the error response body cannot be parsed as JSON
- **THEN** it SHALL throw an `ApiError` with `status` from the HTTP response, `message` from `response.statusText`, and no `detail`

### Requirement: Simplified retry logic
The TanStack Query retry function SHALL use `ApiError.status` directly instead of parsing `error.message` as JSON.

#### Scenario: 4xx error does not retry
- **WHEN** a query fails with an `ApiError` where `status` is 400-499 (except 408)
- **THEN** TanStack Query SHALL NOT retry the request

#### Scenario: 5xx error retries with limit
- **WHEN** a query fails with an `ApiError` where `status` is 500+
- **THEN** TanStack Query SHALL retry up to 2 additional times with exponential backoff

#### Scenario: Non-ApiError error retries
- **WHEN** a query fails with an error that is not an `ApiError` (e.g., network failure)
- **THEN** TanStack Query SHALL retry up to 2 additional times
