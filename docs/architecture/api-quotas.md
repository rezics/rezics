# Account-wide API quotas

## Decision

API capacity belongs to an authenticated account (`users.id`), not to an API
token. A token is a credential and permission boundary. It is never a capacity
principal, so creating several tokens cannot multiply the account allowance.

Every admitted API-token request must satisfy all applicable constraints:

1. account-global limits;
2. account operation-specific limits, when the route belongs to a registered
   quota operation;
3. optional token-global safeguards; and
4. optional token operation-specific safeguards.

Token safeguards are independent upper bounds owned by the account. They do not
replace or relax the account policy.

## Policy and assignment model

`api_quota_policy` is the stable policy identity and points to a current
revision. `api_quota_policy_revision` is immutable history containing the
versioned JSON configuration and change reason. Publishing a policy uses
optimistic revision control.

`api_account_quota_binding` assigns one policy to one account and stores the
account-specific override, assignment reason, actor, optional expiry, and its
own optimistic revision. Standard is the fail-safe default. Privileged
assignments require an explicit future expiry; disabled, expired, or invalid
Privileged assignments resolve to Standard without applying their override.

An account override may replace rate, burst, concurrency, daily cost, active
token count, and registered operation limits, but validation keeps every value
inside the assigned policy class. `api_token_quota_override` stores optional
per-token safeguards without duplicating policy identity.

Policy documents use schema version 1. Unknown fields, unknown operation IDs,
partial request-rate pairs, non-integers, and out-of-class values are rejected
at the persistence boundary.

## Admission algorithm

Each route maps to a stable semantic operation rather than using a raw URL as
configuration. Version 1 registers:

| Operation        | Cost units |
| ---------------- | ---------: |
| `search.execute` |          5 |
| `image.upload`   |         10 |

All other routes use the account-global scope and cost one unit. A route may be
renamed without changing policy documents as long as its semantic operation
mapping remains stable.

Admission runs in one PostgreSQL transaction:

1. build account and token constraints;
2. sort their canonical lock keys and take transaction-scoped advisory locks;
3. refill and consume continuous token buckets;
4. charge UTC daily cost units; and
5. acquire expiring concurrency leases.

Any failed constraint aborts the transaction, so earlier constraints are not
partially consumed. Successful daily cost is charged at handler entry and is
not refunded when downstream work fails. This prevents retryable application
failures from becoming free capacity. Concurrency leases are idempotently
released after the response and expire after two minutes if a process dies.

The API returns `429 ApiQuotaExceeded`, a `Retry-After` header, and structured
details identifying the dimension, principal kind, scope, and limit. The
credential-verification abuse limiter remains separate and may also return
`429`; it is not presented as product quota.

## Active-token inventory

The effective account policy also caps active, unexpired tokens. Creation and
reactivation reserve a short-lived inventory slot under an account advisory
lock before calling Better Auth. This keeps the database transaction short
while preventing concurrent requests from exceeding the account cap. Failed
external work releases the reservation, and stale reservations expire.

## Control plane

Console access is split into least-privilege capabilities:

- `platform.api_quota_policy.read`
- `platform.api_quota_policy.update`
- `platform.user.api_quota.read`
- `platform.user.api_quota.update`

Policy revisions, account assignments, resets, and token safeguard changes use
fresh sessions, optimistic revisions, and security audit events. Console policy
management edits immutable policy revisions. The Users inspector manages an
account assignment, required Privileged expiry, bounded overrides, and reset to
Standard. Account owners can only add or remove safeguards on their own tokens.

## Retention and operations

The worker periodically removes expired concurrency leases and token inventory
reservations. Rate state is retained for seven days, longer than the slowest
valid bucket can take to refill. UTC daily usage is retained for 35 days. Policy
revisions and security audit history are not deleted by quota cleanup.
