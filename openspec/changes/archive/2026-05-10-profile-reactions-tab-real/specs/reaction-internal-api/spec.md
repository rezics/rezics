## ADDED Requirements

### Requirement: Internal by-user lookup endpoint

The reaction service SHALL provide `POST /internal/by-user` (protected by `x-internal-secret` matching `REACTION_INTERNAL_SECRET`) that returns reaction events placed on a given target id set, optionally filtered. This endpoint exists to support the main server's profile-scoped Received view without giving the reaction service knowledge of Unit ownership.

Request body:

```ts
{
  targetIds: string[];          // up to 1000 per call; 400 if exceeded
  reactions?: string[];         // optional reaction-type allowlist
  excludeUserId?: string;       // exclude self-reactions
  cursor?: string;              // opaque continuation token
  limit?: number;               // default 20, max 50; clamped
}
```

Response shape:

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

Rows SHALL be ordered `createdAt desc, id desc`. The cursor encoding SHALL be opaque and stable, identical in shape to the cursors emitted by `GET /reaction/given`.

#### Scenario: Successful lookup
- **WHEN** the main server sends `POST /internal/by-user` with `targetIds: ["t1","t2"]`, `excludeUserId: "owner"` and a valid secret
- **THEN** the system returns up to `limit` reactions on those targets where `userId != "owner"`, ordered correctly
- **AND** `nextCursor` reflects continuation availability

#### Scenario: Empty targetIds returns empty result
- **WHEN** the main server sends `POST /internal/by-user` with `targetIds: []`
- **THEN** the system returns `{ items: [], nextCursor: null }`

#### Scenario: targetIds size cap
- **WHEN** the main server sends more than 1000 targetIds in a single request
- **THEN** the system returns status 400 with an error indicating the cap

#### Scenario: Invalid or missing secret
- **WHEN** a client sends `POST /internal/by-user` without a valid `x-internal-secret`
- **THEN** the system returns status 401

#### Scenario: Reaction type filter
- **WHEN** the main server sends `POST /internal/by-user` with `reactions: ["like"]`
- **THEN** the system returns only rows where `reaction = "like"`
