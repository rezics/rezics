# Authentication

Better Auth is the sole owner of credentials, verification tokens, cookies,
and sessions. Backend code never reads an identity from request input or a
client-provided profile ID.

`session.ts` is the only bridge from an HTTP request to application identity:

- `resolveIdentity(headers)` returns anonymous or authenticated Authorization
  for public routes. Its optional profile and Authorization always describe the
  same profile.
- `auth: true` requires a valid session.
- `write: true` additionally rejects active bans and suspensions.
- `contribute: true` has the write restrictions and additionally rejects
  silenced accounts.

All three authenticated macros expose `user`, `session`, `profile`, and one
request-scoped `authorization`. Route and service authorization must go through
it. `profile.unitId` identifies authored data; it is not itself proof
of permission.

`profile.ts` lazily and transactionally creates the application profile paired
with a Better Auth user. This mapping is one-to-one by `authUserId`; a concurrent
first request re-reads the winning profile instead of creating another identity.

Authentication failures are `401`. An authenticated actor denied an operation
receives `403`; visibility checks use `404` when revealing target existence
would leak information. The authorization rules and exceptions are documented
in `authorization/README.md`.
