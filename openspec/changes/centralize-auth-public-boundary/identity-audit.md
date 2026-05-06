# User and Unit Identity Audit

## Search Scope

The audit used repo-wide `rg` searches for `userId`, `unitId`, `userSlug`,
`unitSlug`, `identity.unitId`, `caller.unitId`, `actorUnitId`, and
`viewerUnitId` across `package/contract`, `package/server`, `package/auth`,
`package/api`, `package/app`, `package/admin`, and `package/reaction`.

Follow-up guard searches now return no runtime matches for:

- `identity.unitId`
- `identity?.unitId`
- `caller.unitId`
- `actorUnitId`
- `viewerUnitId`

## Usage Classification

Actor user identity:

- `RezicsSessionClaims.sub`
- `RezicsSessionClaims.userId`
- server `identity.userId`
- server service `caller.userId`
- reaction service `userId` resolved from `rezics-session-token`
- follow, progress, score, feedback, notification, work-link claim, and token
  ownership fields that identify the acting user

Owner user identity:

- `Unit.userId`
- `RealmMember.userId`
- `TagVote.userId`
- `WorkLinkClaim.claimerUserId`
- `WorkLinkClaim.resolvedBy`
- permission helper inputs now named `actorUserId`

Domain unit identity:

- route `:unitId` for `/unit/*`, `/book/*`, `/chapter/*`, `/tag/*`,
  `/realm/*`, `/zone/*`, `/shelf/*`, and other content resources
- Prisma `Unit.id`
- `Book`, `Chapter`, `Post`, `Shelf`, `Tag`, `Realm`, progress, translation,
  and Meili target fields named `unitId`

User slug:

- auth identity confirmation and slug availability checks
- server user search filters and `userService.getBySlug`
- app user profile display handles

Unit slug:

- `Unit.slug`
- unit/tag/realm/zone lookup routes such as `/unit/by-slug/:slug`,
  `/tag/by-slug/:slug`, `/realm/by-slug/:slug`, and `/zone/:slug`

## Corrections Applied

- Main session contracts and signing now use `sub` and `userId`, not `unitId`,
  for actor identity.
- Server auth-boundary, session, reaction write, realm, tag, Meili, unit
  authority, work-link, and work-link claim code now reads actor identity from
  `identity.userId` or `caller.userId`.
- Permission helper parameters and related frontend helpers were renamed from
  actor/viewer unit terminology to actor/viewer user terminology.
- Reaction service auth accepts independently verifiable bearer main sessions
  and cookie-originated main sessions for direct service reads.
- User profile lookup now has an explicit `/user/by-slug/:userSlug` route and
  API client method. Unit slug lookup remains under explicit unit/tag/realm/zone
  slug routes.

## Transitional Exceptions

The current Prisma schema still uses `User.unitId` as the User primary key and
many DTOs expose owner user identity as `user.unitId`. This is a historical
schema naming issue, not a trusted actor-unit equivalence in session claims.
During this change, service access patterns compare authenticated
`identity.userId` to owner fields explicitly. A follow-up schema migration must
rename or add a stable `User.userId` field, update owner foreign keys to
reference it, and expose user DTO owner identity as `userId`.

The current user profile routes still use `/user/:unitId` and generated
frontend routes under `/user/$unitId`. Those params identify a User row through
the historical `User.unitId` primary key. A follow-up route migration should
introduce explicit user profile routes such as `/user/:userId` or
slug-oriented `/u/:userSlug`, then retire the misleading `unitId` name after
compatibility needs are decided.

## Follow-up Migration Tasks

- Add `User.userId` or rename `User.unitId` to `User.userId` in the server
  Prisma schema.
- Update owner foreign keys and indexes that currently reference `User.unitId`
  to reference explicit user identity.
- Update `PublicUser`, `UserDTO`, and related API client types to expose
  `userId` instead of `unitId` for user identity.
- Migrate `/user/:unitId` server and frontend routes to an explicit user
  identity or user slug route namespace.
- Regenerate Prisma client, route trees, contracts, and API clients after the
  schema and route migration.
