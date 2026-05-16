## Why

Today's attention-graph is fragmented and per-domain: `Follow(user→user)` is the only persisted edge, while every other "I want updates from this thing" intent (book chapter releases, realm feeds, shelf changes, tag streams, author/entity new work) is unmodeled. As a consequence, the existing `notification-feed` spec assumes someone hands it a `recipientId`, but that resolution is hard-coded per event type — adding a new notifiable event requires bespoke fan-out logic, and there is no substrate for hotness ranking signals such as "subscriber count" or "viewer-personalised relevance".

The architectural prerequisite (User as a first-class `Unit`) is being established by the upstream `user-namespace-slug` change, so a unified `Subscription(subscriberUnitId → targetUnitId, channels)` edge is now structurally feasible across every Unit type without forking per-domain tables.

The boundary prerequisite (notify service formally integrated into the app, and `/internal/event` reshaped to accept pre-resolved broadcast events) is being established by `notify-broadcast-boundary`, which introduces the `notifyBoundary.broadcast(event)` helper signature and the `KIND_REGISTRY` that this change extends. With both prerequisites in flight, `Subscription` is now both architecturally and operationally feasible.

Two additional concerns belong here because they depend on `Subscription` semantics: (1) DM permission gating moves from `Follow` to `Subscription` (the sender must have a USER→USER subscription with `channels` permitting DM, replacing the current "must follow recipient" check that becomes vacuous when `Follow` retires); (2) the DM inbox UI lands in this change since DM permission is the gate that controls who can be on the conversation list at all.

## What Changes

- **NEW** `Subscription` model: a single edge connecting any subscriber Unit (USER in v1) to any target Unit, with a `channels: String[]` filter using dot-namespaced events and three tiers of wildcard (`'*'`, `'<category>.*'`, `'<category>.<event>'`).
- **NEW** channel registry in `@rezics/contract` declaring per-`UnitType` legal events and categories (e.g., BOOK → `chapter.new`, `chapter.updated`, `review.new`, …).
- **NEW** generic notification fan-out resolver: events declare `{ kind, sourceUnitId }`; recipient set is computed by querying `Subscription` with array-containment over the three wildcard tiers. Hardcoded per-domain recipient logic retires.
- **NEW** denormalized `subscriberCount` cache on `Unit` (popularity baseline; consumed later by hotness ranking, which is out of scope for this change).
- **DUAL-TRACK** with `RealmMember`: `RealmMember` remains the permission edge (carries `roleKey`); `Subscription` is the orthogonal attention edge. Realm join writes both rows in one transaction; leave removes both atomically. Mute = subscription removed/emptied while `RealmMember` stays. Lurking a public realm = subscription only, no `RealmMember`.
- **BREAKING** `Follow` model removed; rows backfilled into `Subscription` with `channels=['*']`. `User.followersCount` / `User.followingsCount` recomputed from `Subscription` aggregates and stay denormalized.
- **BREAKING** notification fan-out path of `notification-feed`: the spec is amended so recipients are resolved from `Subscription` for broadcast events, while explicit-recipient events (mention target, reply parent, DM peer) keep their direct-addressing path.
- **BREAKING** `profile-followers-tab`: data source switches from `Follow` to `Subscription` filtered to USER targets. Externally-visible API shape preserved.
- **BREAKING** `direct-messaging` permission gate: the existing "sender must follow recipient" check (`prisma.follow.findUnique` in `package/server/src/notify-boundary/dm-boundary.api.ts`) is replaced by a `Subscription` check. The sender SHALL have an active `Subscription(subscriberUnitId=senderUnitId, targetUnitId=recipientUnitId)` whose `channels` permits DM (`['*']` or includes a `dm.*` / `dm.message` entry — registry decision made in design.md). Block edges remain out of scope.
- **NEW** DM inbox UI: conversation list, message thread view, and send box land in `package/app`, consuming notify's `GET /dm/conversations`, `GET /dm/conversations/:id/messages`, server's `POST /dm/send`, and notify's `WS /dm` (cookie-authenticated per `notify-broadcast-boundary`). The frontend hook layer (`package/api/src/dm/`) and TanStack Query integration land alongside the UI.
- Out of scope (explicit non-goals listed below): per-channel delivery overrides, block edges, hotness formula, cross-realm subscription (realm-as-subscriber).

## Capabilities

### New Capabilities
- `engagement-subscription`: the `Subscription` edge model, channel registry shape and validation rules, fan-out resolver semantics, dual-track interaction with `RealmMember`, `Follow` retirement migration, and `subscriberCount` denormalization invariants.

### Modified Capabilities
- `notification-feed`: requirement that broadcast recipient resolution SHALL come from `Subscription` query (added); explicit-recipient path SHALL remain for direct-addressed events (clarified). Persisted notification row shape unchanged from what `notify-broadcast-boundary` establishes (`kind`, `sourceUnitId`, `extra`); engagement-subscription only adds new kinds to the registry.
- `profile-followers-tab`: read source SHALL be `Subscription` filtered to `target.type = USER` (replacing direct `Follow` reads); UI contract unchanged.
- `realm-membership-me`: clarify that "join realm" SHALL atomically write both `RealmMember` and `Subscription` rows; "leave realm" SHALL remove both; "mute realm" affects `Subscription` only.
- `direct-messaging`: send permission gate moves from `Follow` to `Subscription`; DM inbox UI added (conversation list, thread, send box). The WS cookie-auth requirement and the `?token=` query-param removal are owned by `notify-broadcast-boundary` and not re-stated here.

## Impact

**Affected packages**:

- `package/server`
  - Prisma schema: add `Subscription` model, `Unit.subscriberCount` column; drop `Follow` model and `Follow[]` relations on `User`; keep `User.followersCount` / `followingsCount` as denormalized counters but rebind their writers.
  - New `subscription` domain (`subscription.api.ts`, `.service.ts`, `.mapper.ts`, `.types.ts`) following the standard backend pattern.
  - `notify-boundary/notify-boundary.client.ts`: extend `resolveRecipients(event)` body (the helper signature lands in `notify-broadcast-boundary`) to union `directRecipients` with the GIN-indexed Subscription query result.
  - `notify-boundary/dm-boundary.api.ts`: replace the `Follow.findUnique` permission check with a `Subscription.findUnique` check (USER→USER edge with `channels` permitting DM).
  - `realm` service: `joinRealm` / `leaveRealm` become two-write transactions covering `RealmMember` and `Subscription`; `muteRealm` operates on `Subscription` only.
  - `follow` service / endpoints: thin compat wrapper that delegates to `Subscription`, OR fully removed in favor of subscription endpoints. Decided in design.md.
  - Migration: backfill `Follow → Subscription`, recount `subscriberCount` for every `Unit`, recount `followersCount` / `followingsCount` for every `User`, then drop `Follow`. Migration also seeds DM-permitting subscriptions for existing follow pairs so existing DM relationships continue to work post-cutover (one-shot data migration, not a runtime compat shim).

- `package/contract`
  - New `subscription` contract: edge shape, channel registry per `UnitType`, validation predicates for channel arrays.
  - Extend `KIND_REGISTRY` (introduced by `notify-broadcast-boundary`) with new entries: `chapter.new`, `chapter.updated`, `chapter.deleted`, `review.new`, `review.updated`, `edition.new`, `metadata.changed`, `cover.changed`, `post.new`, `post.review`, `announcement.new`, `member.joined`, `unit.tagged`, `item.added`, `item.removed`. Aggregatability declared per kind.
  - The notification fan-out event shape `{ kind, sourceUnitId, directRecipients?, extra? }` is owned by `notify-broadcast-boundary`; this change adds new `kind` values, not new fields.

- `package/api`
  - New TanStack Query hooks: `useSubscribe`, `useUnsubscribe`, `useUpdateSubscriptionChannels`, `useIsSubscribed`, `useSubscriberCount`, `useMySubscriptions`.
  - `profile-followers-tab` hooks rebind to subscription source.
  - New `package/api/src/dm/` module: `useConversations`, `useMessages(conversationId)`, `useSendDm`, `useDmStream` (WS client opening notify's `WS /dm` cookie-authenticated per `notify-broadcast-boundary`).

- `package/app`
  - `engagement-shelf-action` and similar bell/follow widgets compose against the subscription hook family.
  - Realm UI: the existing single "Join" button stays; a separate notification preference control on the realm header surfaces channel filter (deferred polish, scope flagged in design).
  - DM inbox UI: conversation list page, conversation thread view, send box. Routes added under `/inbox/dm/*`. WS client mounted post-login to receive incoming messages live.

- `package/admin`
  - No requirement changes in v1; future ops dashboards may surface subscriber counts but are out of scope.

**Dependencies**:

- **Hard dependency**: `user-namespace-slug` (L3) MUST be applied before this change. `Subscription.subscriberUnitId` references `Unit.id where type=USER`, which only exists after User-as-Unit migration.
- **Hard dependency**: `notify-broadcast-boundary` MUST be applied before this change. It introduces (a) the `notifyBoundary.broadcast(event)` helper signature whose `resolveRecipients` body this change extends, (b) the `KIND_REGISTRY` this change adds entries to, (c) the cookie-scope and CORS-credentials infrastructure the new DM and notification frontend hooks rely on, and (d) the WS cookie-auth path the new DM stream client uses.
- **Coordinated with**: `notification-feed` and `notification-stream` specs (already amended by `notify-broadcast-boundary` to a `kind`/`sourceUnitId`/`extra` shape; this change adds new `kind` values).

**Backward compatibility**:

This is a development-stage breaking change per `CLAUDE.md` policy. No dual-read window, no `Follow` alias table. The `/follow/*` HTTP endpoints either retire or are renamed — final decision in design.md. External clients and internal callsites cut over in one commit per the project's "one clean breaking cutover" rule.

**Performance & indexing**:

- `Subscription` carries `@@unique([subscriberUnitId, targetUnitId])`, btree on `targetUnitId` (fan-out hot path) and on `subscriberUnitId` ("my subscriptions" path).
- Channel filter array uses a Postgres GIN index (`USING gin (channels)`) added via raw migration so the three wildcard-tier `@>` checks are index-served.
- `Unit.subscriberCount` denormalized counter avoids `COUNT(*)` on every render of a target page.
