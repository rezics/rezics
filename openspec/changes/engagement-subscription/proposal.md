## Why

Today's attention-graph is fragmented and per-domain: `Follow(user→user)` is the only persisted edge, while every other "I want updates from this thing" intent (book chapter releases, realm feeds, shelf changes, tag streams, author/entity new work) is unmodeled. As a consequence, the existing `notification-feed` spec assumes someone hands it a `recipientId`, but that resolution is hard-coded per event type — adding a new notifiable event requires bespoke fan-out logic, and there is no substrate for hotness ranking signals such as "subscriber count" or "viewer-personalised relevance".

The architectural prerequisite (User as a first-class `Unit`) is being established by the upstream `user-namespace-slug` change, so a unified `Subscription(subscriberUnitId → targetUnitId, channels)` edge is now structurally feasible across every Unit type without forking per-domain tables.

## What Changes

- **NEW** `Subscription` model: a single edge connecting any subscriber Unit (USER in v1) to any target Unit, with a `channels: String[]` filter using dot-namespaced events and three tiers of wildcard (`'*'`, `'<category>.*'`, `'<category>.<event>'`).
- **NEW** channel registry in `@rezics/contract` declaring per-`UnitType` legal events and categories (e.g., BOOK → `chapter.new`, `chapter.updated`, `review.new`, …).
- **NEW** generic notification fan-out resolver: events declare `{ kind, sourceUnitId }`; recipient set is computed by querying `Subscription` with array-containment over the three wildcard tiers. Hardcoded per-domain recipient logic retires.
- **NEW** denormalized `subscriberCount` cache on `Unit` (popularity baseline; consumed later by hotness ranking, which is out of scope for this change).
- **DUAL-TRACK** with `RealmMember`: `RealmMember` remains the permission edge (carries `roleKey`); `Subscription` is the orthogonal attention edge. Realm join writes both rows in one transaction; leave removes both atomically. Mute = subscription removed/emptied while `RealmMember` stays. Lurking a public realm = subscription only, no `RealmMember`.
- **BREAKING** `Follow` model removed; rows backfilled into `Subscription` with `channels=['*']`. `User.followersCount` / `User.followingsCount` recomputed from `Subscription` aggregates and stay denormalized.
- **BREAKING** notification fan-out path of `notification-feed`: the spec is amended so recipients are resolved from `Subscription` for broadcast events, while explicit-recipient events (mention target, reply parent, DM peer) keep their direct-addressing path.
- **BREAKING** `profile-followers-tab`: data source switches from `Follow` to `Subscription` filtered to USER targets. Externally-visible API shape preserved.
- Out of scope (explicit non-goals listed below): per-channel delivery overrides, block edges, hotness formula, cross-realm subscription (realm-as-subscriber).

## Capabilities

### New Capabilities
- `engagement-subscription`: the `Subscription` edge model, channel registry shape and validation rules, fan-out resolver semantics, dual-track interaction with `RealmMember`, `Follow` retirement migration, and `subscriberCount` denormalization invariants.

### Modified Capabilities
- `notification-feed`: requirement that broadcast recipient resolution SHALL come from `Subscription` query (added); explicit-recipient path SHALL remain for direct-addressed events (clarified). Persisted notification row shape unchanged.
- `profile-followers-tab`: read source SHALL be `Subscription` filtered to `target.type = USER` (replacing direct `Follow` reads); UI contract unchanged.
- `realm-membership-me`: clarify that "join realm" SHALL atomically write both `RealmMember` and `Subscription` rows; "leave realm" SHALL remove both; "mute realm" affects `Subscription` only.

## Impact

**Affected packages**:

- `package/server`
  - Prisma schema: add `Subscription` model, `Unit.subscriberCount` column; drop `Follow` model and `Follow[]` relations on `User`; keep `User.followersCount` / `followingsCount` as denormalized counters but rebind their writers.
  - New `subscription` domain (`subscription.api.ts`, `.service.ts`, `.mapper.ts`, `.types.ts`) following the standard backend pattern.
  - `notification` service: replace per-event hardcoded recipient resolution with a generic fan-out helper that queries `Subscription`.
  - `realm` service: `joinRealm` / `leaveRealm` become two-write transactions covering `RealmMember` and `Subscription`; `muteRealm` operates on `Subscription` only.
  - `follow` service / endpoints: thin compat wrapper that delegates to `Subscription`, OR fully removed in favor of subscription endpoints. Decided in design.md.
  - Migration: backfill `Follow → Subscription`, recount `subscriberCount` for every `Unit`, recount `followersCount` / `followingsCount` for every `User`, then drop `Follow`.

- `package/contract`
  - New `subscription` contract: edge shape, channel registry per `UnitType`, validation predicates for channel arrays, fan-out request/response types.
  - Notification fan-out event shape: `{ kind: string, sourceUnitId: string, directRecipients?: string[], payload?: Json }`.

- `package/api`
  - New TanStack Query hooks: `useSubscribe`, `useUnsubscribe`, `useUpdateSubscriptionChannels`, `useIsSubscribed`, `useSubscriberCount`, `useMySubscriptions`.
  - `profile-followers-tab` hooks rebind to subscription source.

- `package/app`
  - `engagement-shelf-action` and similar bell/follow widgets compose against the subscription hook family.
  - Realm UI: the existing single "Join" button stays; a separate notification preference control on the realm header surfaces channel filter (deferred polish, scope flagged in design).

- `package/admin`
  - No requirement changes in v1; future ops dashboards may surface subscriber counts but are out of scope.

**Dependencies**:

- **Hard dependency**: `user-namespace-slug` (L3) MUST be applied before this change. `Subscription.subscriberUnitId` references `Unit.id where type=USER`, which only exists after User-as-Unit migration.
- **Coordinated with**: `notification-feed` and `notification-stream` specs. The persistence row shape and SSE event shape are unchanged; only the recipient-resolution layer in the service is rewritten.

**Backward compatibility**:

This is a development-stage breaking change per `CLAUDE.md` policy. No dual-read window, no `Follow` alias table. The `/follow/*` HTTP endpoints either retire or are renamed — final decision in design.md. External clients and internal callsites cut over in one commit per the project's "one clean breaking cutover" rule.

**Performance & indexing**:

- `Subscription` carries `@@unique([subscriberUnitId, targetUnitId])`, btree on `targetUnitId` (fan-out hot path) and on `subscriberUnitId` ("my subscriptions" path).
- Channel filter array uses a Postgres GIN index (`USING gin (channels)`) added via raw migration so the three wildcard-tier `@>` checks are index-served.
- `Unit.subscriberCount` denormalized counter avoids `COUNT(*)` on every render of a target page.
