## ADDED Requirements

### Requirement: WorkLinkClaim entity stores pending cross-user work-release linkage requests

The system SHALL persist a `WorkLinkClaim` Prisma model with the following fields:

- `id` (uuidv7, primary key)
- `releaseUnitId` (uuid, indexed, references `Unit.id`, `onDelete: Cascade`)
- `workUnitId` (uuid, indexed, references `Unit.id`, `onDelete: Cascade`)
- `claimerUserId` (uuid, indexed, references `User.id`)
- `status` (enum `ClaimStatus`: `PENDING`, `APPROVED`, `REJECTED`, `WITHDRAWN`)
- `rejectReason` (string, nullable)
- `createdAt` (timestamp, default now)
- `resolvedAt` (timestamp, nullable)
- `resolvedBy` (uuid, nullable, references `User.id`)

Compound indexes SHALL include `(workUnitId, status)` and `(claimerUserId, status)` to support inbox queries on both sides.

#### Scenario: Claim row created on pending link request

- GIVEN the conditions that produce a pending result on `PATCH /units/:releaseId/work-link` (release-side authority only, target work-side authority absent, work type not in `WIKI_TYPES`)
- WHEN the request is processed
- THEN a `WorkLinkClaim` row SHALL be inserted with `status = PENDING`, `releaseUnitId`, `workUnitId`, `claimerUserId = caller.userId`, `createdAt = now()`, and `resolvedAt = null`

### Requirement: GET /units/:workUnitId/work-link-claims lists claims targeting a work

The unit API SHALL expose `GET /units/:workUnitId/work-link-claims` accepting an optional `status` query parameter (default `PENDING`). The endpoint SHALL return all `WorkLinkClaim` rows for the given work matching the requested status, ordered by `createdAt` descending.

Authorization SHALL require `hasAuthorityOver(caller, workUnit)`.

#### Scenario: Work owner inspects their pending claim inbox

- GIVEN a Work Unit "work-x" owned by user A
- AND three `WorkLinkClaim` rows targeting "work-x", two with `status = PENDING` and one with `status = APPROVED`
- WHEN user A invokes `GET /units/work-x/work-link-claims?status=PENDING`
- THEN the response SHALL contain exactly the two `PENDING` rows
- AND the rows SHALL be ordered by `createdAt` descending

#### Scenario: Stranger cannot list a work's claims

- GIVEN a Work Unit "work-x" owned by user A
- WHEN user B (no admin, no realm-mod authority) invokes `GET /units/work-x/work-link-claims`
- THEN the request SHALL be rejected with `403 Forbidden`

### Requirement: POST /work-link-claims/:claimId/approve sets the link

The unit API SHALL expose `POST /work-link-claims/:claimId/approve`. The endpoint SHALL:

1. Require `hasAuthorityOver(caller, claim.workUnit)`.
2. Reject if `claim.status !== PENDING`.
3. Atomically: set `releaseUnit.workUnitId = claim.workUnitId`, set `claim.status = APPROVED`, `claim.resolvedAt = now()`, `claim.resolvedBy = caller.userId`.
4. Trigger a `notify-system-email` notification to `claim.claimerUserId` with the approval result.

#### Scenario: Work owner approves a translator's claim

- GIVEN a `WorkLinkClaim` "c1" with `status = PENDING`, `releaseUnitId = "rel-y"`, `workUnitId = "work-x"`, `claimerUserId = "user-b"`
- AND the caller has authority over "work-x"
- WHEN the caller invokes `POST /work-link-claims/c1/approve`
- THEN "rel-y".workUnitId SHALL be set to "work-x"
- AND "c1".status SHALL be `APPROVED`, "c1".resolvedAt SHALL be set, "c1".resolvedBy SHALL be the caller's user id
- AND user "user-b" SHALL receive a system notification with email of the approval

#### Scenario: Approving a non-pending claim is rejected

- GIVEN a `WorkLinkClaim` "c1" with `status = REJECTED`
- WHEN the caller invokes `POST /work-link-claims/c1/approve`
- THEN the request SHALL be rejected with a `409 Conflict` (or equivalent semantic error)
- AND no link SHALL be created

### Requirement: POST /work-link-claims/:claimId/reject rejects the claim

The unit API SHALL expose `POST /work-link-claims/:claimId/reject` accepting an optional body `{ reason?: string }`. The endpoint SHALL:

1. Require `hasAuthorityOver(caller, claim.workUnit)`.
2. Reject if `claim.status !== PENDING`.
3. Atomically: set `claim.status = REJECTED`, `claim.rejectReason = body.reason ?? null`, `claim.resolvedAt = now()`, `claim.resolvedBy = caller.userId`.
4. Leave `releaseUnit.workUnitId` unchanged.
5. Trigger a `notify-system-email` notification to `claim.claimerUserId` with the rejection result and reason.

#### Scenario: Work owner rejects a claim with reason

- GIVEN a `WorkLinkClaim` "c1" with `status = PENDING`
- AND the caller has authority over `claim.workUnit`
- WHEN the caller invokes `POST /work-link-claims/c1/reject` with body `{ reason: "Translation quality insufficient." }`
- THEN "c1".status SHALL be `REJECTED`
- AND "c1".rejectReason SHALL be `"Translation quality insufficient."`
- AND the corresponding release Unit's `workUnitId` SHALL remain unchanged
- AND the claimer SHALL receive a system notification with email containing the reason

### Requirement: DELETE /work-link-claims/:claimId allows the claimer to withdraw

The unit API SHALL expose `DELETE /work-link-claims/:claimId`. The endpoint SHALL:

1. Allow the call only if `caller.userId === claim.claimerUserId` (the original submitter), OR `hasAuthorityOver(caller, claim.releaseUnit)` is true.
2. Reject if `claim.status !== PENDING`.
3. Atomically: set `claim.status = WITHDRAWN`, `claim.resolvedAt = now()`, `claim.resolvedBy = caller.userId`.
4. Optionally trigger a notification to the work owner indicating withdrawal (this is informational and MAY be omitted).

#### Scenario: Claimer withdraws their own pending request

- GIVEN a `WorkLinkClaim` "c1" with `status = PENDING`, `claimerUserId = "user-b"`
- WHEN user B invokes `DELETE /work-link-claims/c1`
- THEN "c1".status SHALL be `WITHDRAWN`
- AND "c1".resolvedAt SHALL be set

#### Scenario: Third party cannot withdraw

- GIVEN a `WorkLinkClaim` "c1" with `status = PENDING`, `claimerUserId = "user-b"`
- WHEN user C (not the claimer, no authority over the release) invokes `DELETE /work-link-claims/c1`
- THEN the request SHALL be rejected with `403 Forbidden`

### Requirement: Claim creation deduplicates within a window

When a `PATCH /units/:releaseId/work-link` request would create a `WorkLinkClaim` and an existing `PENDING` claim with the same `(releaseUnitId, workUnitId, claimerUserId)` already exists, the system SHALL return the existing claim's `claimId` rather than create a duplicate row. The system MAY refresh the existing claim's `createdAt` to indicate continued interest, but SHALL NOT change its `status`.

#### Scenario: Repeated submission returns the same claim

- GIVEN a pending `WorkLinkClaim` "c1" exists for `(releaseUnitId = "rel-y", workUnitId = "work-x", claimerUserId = "user-b")`
- WHEN user B re-submits `PATCH /units/rel-y/work-link` with body `{ workUnitId: "work-x" }`
- THEN no new `WorkLinkClaim` row SHALL be created
- AND the response SHALL be `{ status: "PENDING", claimId: "c1" }`

### Requirement: Notify on PENDING claim creation

When a `WorkLinkClaim` row is created with `status = PENDING`, the system SHALL invoke the `notify-system-email` capability targeting the `userId` of the work Unit's owner. If the work has `userId = null` (system-owned), the notification SHALL instead target a configured admin or moderation channel. The notification payload SHALL include claim id, release unit summary, and a deep link to the work-side approval UI.

#### Scenario: New PENDING claim notifies the work owner

- GIVEN a Work Unit "work-x" with `userId = "user-a"`
- WHEN a `PENDING` `WorkLinkClaim` row referencing "work-x" is inserted
- THEN exactly one `notify-system-email` invocation SHALL be issued to user "user-a"
- AND the payload SHALL include the new claim's id and the release unit's identifying information

### Requirement: Cascade delete behavior

If either referenced Unit (release or work) is hard-deleted, the corresponding `WorkLinkClaim` rows SHALL be removed via `onDelete: Cascade`. Soft-deletion (`status = DELETED` on Unit) SHALL NOT cascade automatically; pending claims for soft-deleted units SHALL be filtered out at read time.

#### Scenario: Hard-deleting a referenced unit removes claims

- GIVEN a `WorkLinkClaim` "c1" referencing release "rel-y" and work "work-x"
- WHEN "rel-y" is hard-deleted from the database
- THEN "c1" SHALL be removed by the cascade

#### Scenario: Soft-deleted unit hides claims at read time

- GIVEN a `WorkLinkClaim` "c1" with `status = PENDING` referencing release "rel-y"
- AND "rel-y".status is updated to `DELETED`
- WHEN `GET /units/work-x/work-link-claims?status=PENDING` is invoked
- THEN "c1" SHALL be omitted from the response
