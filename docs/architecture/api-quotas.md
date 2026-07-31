# Account and API-token quotas

## Decision

Accounts and API tokens are independent quota subjects. Every admitted
API-token request must pass both subjects, so creating more tokens never
multiplies the account allowance and a permissive token policy never bypasses a
more restrictive account policy.

The applicable constraints are:

1. account-global limits;
2. account operation-specific limits, when registered for the route;
3. token-global limits;
4. token operation-specific limits, when registered for the route; and
5. an optional owner-managed token safeguard, merged into the token limits by
   taking the more restrictive value for every configured dimension.

Account and token policies may be higher or lower than each other. Their
counters remain separate and admission requires all of them. An owner safeguard
can only reduce the effective token capacity; it cannot widen a platform policy.

## Policy and assignment model

`api_quota_policy` is the stable policy identity. Its `subject_kind` is either
`account` or `token`, and it points to a current immutable
`api_quota_policy_revision`. Policy documents contain global and registered
operation limits. Account policy documents additionally contain the active-token
inventory limit.

`api_account_quota_binding` and `api_token_quota_binding` assign one compatible
policy to one subject and store the subject-specific override, assignment reason,
actor, optional expiry, and optimistic revision. Composite foreign keys include
the subject kind, so the database rejects an account policy assigned to a token
or a token policy assigned to an account.

Each subject kind has a Standard fail-safe default. Privileged assignments
require an explicit future expiry; disabled, expired, or invalid Privileged
assignments resolve to that subject kind's Standard default without applying the
expired override.

`api_token_quota_override` stores the token owner's optional safeguard. It is
not a platform policy assignment and is always intersected with the effective
token policy.

Policy documents use schema version 1. Unknown fields, unknown operation IDs,
partial request-rate pairs, non-integers, and out-of-class values are rejected at
the persistence boundary.

## Admission algorithm

Each route maps to a stable semantic operation rather than using a raw URL as
configuration. Version 1 registers:

| Operation        | Cost units |
| ---------------- | ---------: |
| `search.execute` |          5 |
| `image.upload`   |         10 |

All other routes use the global scopes and cost one unit. A route may be renamed
without changing policy documents as long as its semantic operation mapping
remains stable.

Admission runs in one PostgreSQL transaction:

1. build account and token constraints;
2. sort their canonical lock keys and take transaction-scoped advisory locks;
3. refill and consume continuous token buckets;
4. charge UTC daily cost units; and
5. acquire expiring concurrency leases.

Any failed constraint aborts the transaction, so earlier constraints are not
partially consumed. Successful daily cost is charged at handler entry and is not
refunded when downstream work fails. Concurrency leases are idempotently
released after the response and expire after two minutes if a process dies.

The API returns `429 ApiQuotaExceeded`, a `Retry-After` header, and structured
details identifying the dimension, subject kind, scope, and limit. The
credential-verification abuse limiter remains separate and may also return
`429`; it is not presented as product quota.

## Active-token inventory

The effective account policy caps active, unexpired tokens. Creation and
reactivation reserve a short-lived inventory slot under an account advisory lock
before calling Better Auth. This keeps the database transaction short while
preventing concurrent requests from exceeding the account cap. Failed external
work releases the reservation, and stale reservations expire.

## Control plane

Console access is split into least-privilege capabilities:

- `platform.api_quota_policy.read`
- `platform.api_quota_policy.update`
- `platform.user.api_quota.read`
- `platform.user.api_quota.update`
- `platform.user.api_token.api_quota.read`
- `platform.user.api_token.api_quota.update`

Policy revisions and both kinds of assignments use fresh sessions, optimistic
revisions, and security audit events. The Console policy area edits immutable
account and token policy revisions. The Users inspector manages the account
assignment and lists every token belonging to that account for independent
policy assignment, bounded overrides, expiry, and reset to Standard. Token
secrets are never returned by the administrative inventory endpoint.

Account owners can only add or remove safeguards on their own tokens. Those
changes cannot relax the platform-assigned token policy.

## Retention and operations

The worker periodically removes expired concurrency leases and token inventory
reservations. Rate state is retained for seven days, longer than the slowest
valid bucket can take to refill. UTC daily usage is retained for 35 days. Policy
revisions and security audit history are not deleted by quota cleanup.
