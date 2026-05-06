# Reaction Service Boundary Audit

## Public Reaction Service Endpoints

`GET /reaction/summary` remains independently reachable. It is an aggregate
read by target unit IDs and does not need actor identity, main permissions, or
main database context.

`GET /reaction/my` remains independently reachable when the caller presents a
verifiable `rezics-session-token`. The reaction service only needs the actor
`userId` to fetch the caller's own reactions. It now accepts both bearer
transport for non-browser/service clients and cookie-originated main session
transport for browser reads.

## Main-Owned Reaction Writes

`POST /reaction` and `DELETE /reaction` stay on the main server. Main validates
the caller through the main session, uses `identity.userId` as the actor, and
calls the reaction service internal API with `x-internal-secret`.

Creates remain main-owned because main also loads the target Unit owner and may
emit product notifications. That requires main DB context beyond the actor
`userId`.

## Internal Reaction Service Endpoints

`POST /internal/create`, `POST /internal/remove`, and `POST /internal/cleanup`
remain service-to-service endpoints protected by `x-internal-secret`. They do
not accept browser sessions and are not public product APIs.

## Main Proxy Requirement

No additional public reaction service endpoint currently needs a main proxy.
Endpoints that only need `userId` can remain independently reachable with main
session verification. Endpoints that need main-owned mutations, notification
side effects, resource ownership checks, or non-`userId` main context must stay
on main or be added to main before calling reaction internally.
