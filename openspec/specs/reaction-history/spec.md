## Requirements

### Requirement: Reaction service exposes Given history

The reaction service SHALL provide `GET /reaction/given` that returns the requested user's own reaction events in reverse-chronological order. Query parameters:

- `userId` (required): the user whose Given history to return.
- `reactions` (optional, comma-separated): filter to reactions of these types. Default: all allowlisted types.
- `cursor` (optional, opaque): continuation token from a prior response.
- `limit` (optional, integer): page size. Default 20, max 50; invalid values clamp to bounds.

The response shape SHALL be:

```ts
{
  items: Array<{
    id: string;
    userId: string;
    targetId: string;
    reaction: string;
    createdAt: string; // ISO 8601
  }>;
  nextCursor: string | null;
}
```

The endpoint SHALL NOT require authentication. Privacy gating happens at the main-server proxy layer.

#### Scenario: First page
- **WHEN** a client sends `GET /reaction/given?userId=u1&limit=20`
- **THEN** the system returns up to 20 most recent reactions placed by `u1`, ordered by `createdAt` desc with `id` desc as tiebreaker
- **AND** `nextCursor` encodes the last row's `(createdAt, id)` if more rows exist, else `null`

#### Scenario: Continuation
- **WHEN** a client sends `GET /reaction/given?userId=u1&cursor=<cursor>` using the `nextCursor` from a prior response
- **THEN** the system returns the next page of reactions strictly older than the cursor row, in the same order
- **AND** rows are not repeated across pages

#### Scenario: Filter by reaction type
- **WHEN** a client sends `GET /reaction/given?userId=u1&reactions=like`
- **THEN** the system returns only reactions where `reaction = "like"`

#### Scenario: User with no reactions
- **WHEN** a client sends `GET /reaction/given?userId=u-empty`
- **THEN** the system returns `{ items: [], nextCursor: null }`

#### Scenario: Limit clamping
- **WHEN** a client sends `GET /reaction/given?userId=u1&limit=10000`
- **THEN** the system clamps `limit` to the configured maximum (default 50)
- **AND** returns at most that many rows

### Requirement: Reaction service exposes internal by-user lookup for Received

The reaction service SHALL provide `POST /internal/by-user` (protected by `x-internal-secret`) that returns reaction events placed on a given target id set, optionally filtered. Used by the main server to satisfy the Received view.

Request body:

```ts
{
  targetIds: string[];          // up to 1000 per call
  reactions?: string[];         // optional allowlist filter
  excludeUserId?: string;       // exclude self-reactions (typically the profile owner)
  cursor?: string;              // opaque continuation token
  limit?: number;               // default 20, max 50
}
```

Response shape mirrors `GET /reaction/given`. The reaction service does NOT know about Unit ownership; the main server is responsible for supplying the correct `targetIds`.

#### Scenario: Successful lookup
- **WHEN** the main server sends `POST /internal/by-user` with `targetIds: ["u1","u2"]`, `excludeUserId: "owner"` and a valid secret
- **THEN** the system returns up to `limit` reactions on those targets where `userId != "owner"`, ordered `createdAt desc, id desc`

#### Scenario: Empty targetIds
- **WHEN** the main server sends `POST /internal/by-user` with `targetIds: []`
- **THEN** the system returns `{ items: [], nextCursor: null }`

#### Scenario: Continuation
- **WHEN** the main server passes a `cursor` from a prior response
- **THEN** the system returns the next page strictly older than the cursor row

#### Scenario: targetIds size cap
- **WHEN** the main server sends more than 1000 targetIds in a single request
- **THEN** the system returns status 400 with an error indicating the cap

#### Scenario: Invalid or missing secret
- **WHEN** a client sends `POST /internal/by-user` without a valid `x-internal-secret`
- **THEN** the system returns status 401

### Requirement: Main server exposes profile-scoped Given history

The main server SHALL provide `GET /profile/:userId/reactions/given` that proxies the reaction-service `GET /reaction/given` and hydrates each row with target metadata sufficient for the frontend to render a row. Response item shape:

```ts
{
  id: string;
  reaction: string;
  createdAt: string;
  target: {
    unitId: string;
    kind: "post" | "review" | "remark" | "excerpt" | "shelf" | "realm" | "book";
    title?: string;
    snippet?: string;
    href: string; // route to detail page
  } | null; // null if the target unit has been deleted
}
```

The endpoint SHALL enforce profile visibility: if the requested profile is private and the viewer cannot access it, return 403. Rate-limit applies via the existing public-route gateway.

#### Scenario: Public profile, anonymous viewer
- **WHEN** an anonymous client requests `GET /profile/u1/reactions/given`
- **THEN** the server returns the user's reactions hydrated with target metadata

#### Scenario: Private profile, unauthorized viewer
- **WHEN** a viewer who cannot access user u1's profile requests `GET /profile/u1/reactions/given`
- **THEN** the server returns 403

#### Scenario: Target unit deleted
- **WHEN** one of the user's reactions points to a `targetId` whose Unit has been deleted
- **THEN** that row's `target` field is `null`
- **AND** the response otherwise contains the row with its `id`, `reaction`, `createdAt`

### Requirement: Main server exposes profile-scoped Received history

The main server SHALL provide `GET /profile/:userId/reactions/received` that lists reactions placed by other users on units owned by `:userId`. The server resolves the user's owned `unitId` set via existing user-unit lookups, calls the reaction service `POST /internal/by-user` with `excludeUserId` set to the profile owner, and hydrates both target and actor metadata. Response item shape:

```ts
{
  id: string;
  reaction: string;
  createdAt: string;
  actor: {
    userId: string;
    displayName: string;
    avatarUrl?: string;
    href: string; // route to actor profile
  };
  target: {
    unitId: string;
    kind: "post" | "review" | "remark" | "excerpt" | "shelf" | "realm" | "book";
    title?: string;
    snippet?: string;
    href: string;
  } | null;
}
```

The endpoint SHALL enforce profile visibility identically to Given. Self-reactions (where `actor.userId === :userId`) SHALL be excluded by default.

#### Scenario: Received returns rows from multiple actors
- **WHEN** users a, b, c have reacted to units owned by u1 and a viewer requests `GET /profile/u1/reactions/received`
- **THEN** the response contains up to `limit` rows, each tagged with the correct `actor`
- **AND** rows are ordered `createdAt desc, id desc`

#### Scenario: Self-reactions excluded
- **WHEN** the profile owner has reacted to their own unit
- **THEN** that row does NOT appear in the response

#### Scenario: User owns no units
- **WHEN** the profile owner has not authored any units
- **THEN** the response is `{ items: [], nextCursor: null }`

#### Scenario: Pagination through power-user owned set
- **WHEN** the profile owner owns more units than fit in a single internal-call chunk (>1000)
- **THEN** the server iterates through ownership chunks across calls
- **AND** the client-visible cursor remains stable across the iteration
- **AND** rows are not repeated or skipped

### Requirement: Cursor encoding is opaque and stable

`nextCursor` values SHALL be opaque strings (base64-url-encoded) that round-trip the underlying `(createdAt, id)` tiebreaker pair. Clients SHALL treat the cursor as opaque. The server SHALL accept any cursor it has previously emitted within the configured retention window (effectively unlimited for normal use).

#### Scenario: Cursor decodes successfully
- **WHEN** a client passes back the `nextCursor` from a prior response
- **THEN** the server decodes it to `(createdAt, id)` and returns rows strictly older than that pair

#### Scenario: Malformed cursor
- **WHEN** a client passes a malformed `cursor`
- **THEN** the server returns 400 with an error
