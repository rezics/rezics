## Context

The repository today carries one persisted attention edge — `Follow(followerId, followingId)` — limited to user→user. Every other "I want updates from this thing" intent is unmodeled at the data layer:

- Realm join lives in `RealmMember(realmUnitId, userId, roleKey)`, which conflates **permission** (can post / moderate / banned) with the implicit assumption that members also receive realm activity.
- "Watch this book for new chapters", "subscribe to a tag stream", "track shelf additions", "get notified on new work by an author" — none persist as edges.
- The `notification-feed` spec persists rows keyed by `recipientId` but assumes the producer of an event already knows who all the recipients are. In practice the producer hard-codes recipient resolution per event type (post-author for replies, followee for new posts, etc.), and adding a new event family means writing new fan-out logic.

Hotness ranking has no popularity input; rating-style `ScoreEntry`/`ScoreAggregate` exist but measure quality, not attention. There is no substrate for either "this Unit has N watchers" or "this viewer cares about this Unit" personalization.

The architectural blocker — User and Unit being in different identity universes — is removed by `user-namespace-slug` (L3): once `User.unitId ≡ Unit.id where type=USER`, both ends of an attention edge are typed as `Unit.id`, and a generic `Subscription(subscriberUnitId → targetUnitId)` is structurally feasible across every Unit type.

This design specifies that generic edge.

## Goals / Non-Goals

**Goals:**

- Replace `Follow` with a generic `Subscription` edge usable for any `(USER subscriber → any Unit target)` pair.
- Express subscription **scope** with a per-edge channel filter that is cheap to query during fan-out (this is the hot path).
- Provide a single recipient-resolution helper that the notification system uses for **broadcast** events, eliminating per-domain hard-coded fan-out.
- Preserve `RealmMember` as the orthogonal permission edge; realm join becomes a two-write transaction, leave is the inverse.
- Maintain a denormalized `subscriberCount` per Unit as a popularity baseline for downstream ranking work.
- Make the `Follow → Subscription` migration a single clean cutover with no dual-read window.

**Non-Goals:**

- **Hotness ranking formula.** This change provides `subscriberCount` as input; the formula and any personalization logic ship in a separate ranking spec.
- **Per-channel-per-delivery overrides.** Whether a particular channel goes to email vs in-app vs push is global preference (existing `notify-system-email` etc.); per-edge override is not in v1. A `delivery Json?` column is not added — if needed later, it ships as a separate column without touching `channels`.
- **Block / mute-actor edges.** A "blocked actor" graph is its own concern (visibility, not subscription) and is out of scope.
- **Cross-realm subscription / realm-as-subscriber.** Subscriber side is restricted to USER in v1. Schema does not enforce this — service layer does — keeping the door open without paying for it now.
- **Granular post-level reply subscriptions surfaced in UI.** Schema supports `Subscription(user → post-unit, channels=['reply.new'])` since post is a Unit; whether/how to expose it in the UI is a follow-on product decision.
- **Notification persistence row shape changes.** `notification-feed`'s row schema is untouched; only the upstream recipient-resolution layer is rewritten.

## Decisions

### D1. Subscription is a separate model, NOT a property of `RealmMember` or a polymorphic shape on `Follow`

```prisma
model Subscription {
  id               String   @id @default(dbgenerated("uuidv7()")) @db.Uuid
  subscriberUnitId String   @db.Uuid
  targetUnitId     String   @db.Uuid
  channels         String[]
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  @@unique([subscriberUnitId, targetUnitId])
  @@index([targetUnitId])
  @@index([subscriberUnitId])
  // GIN index on channels added via raw SQL migration
}
```

**Rationale:** RealmMember carries `roleKey` and is permission-bearing; ~90% of subscriptions (book, tag, shelf, user) have no role concept. Putting `roleKey` on a generic table would make the column null for nearly every row and leak realm-specific semantics into the generic edge. Keeping the two tables separate gives them independent lifecycles: a user can be banned (member dropped) yet keep watching the public realm; a user can mute (subscription cleared) yet keep posting rights.

**Alternatives considered:**

- *Single `RealmMember` polymorphic to all targets*: rejected — would force `roleKey` everywhere and blur permission/attention.
- *Extend `Follow` with a target-type discriminator*: rejected — same structural cost as a new model with worse historical naming.
- *Subscription as a JSON blob on `User.extra`*: rejected — kills query path, no fan-out, no GIN index.

### D2. `channels` is `String[]` with dot-namespacing and three wildcard tiers

```
Tier 1:  '*'                    — every event on this target
Tier 2:  '<category>.*'         — every event in this category
Tier 3:  '<category>.<event>'   — exact event
```

Examples for a BOOK target:

```ts
['*']                                     // everything
['chapter.*']                             // every chapter event
['chapter.new', 'review.new']             // exact two events
['chapter.*', 'review.new']               // mix wildcard + exact
```

Fan-out query (incoming event = `chapter.new`, source = `bookId`):

```sql
SELECT "subscriberUnitId"
FROM "Subscription"
WHERE "targetUnitId" = $1
  AND (
    channels @> ARRAY['chapter.new']
    OR channels @> ARRAY['chapter.*']
    OR channels @> ARRAY['*']
  );
```

Three GIN-indexable array-containment checks. No glob runtime, no jsonb traversal.

**Rationale:**

- Fan-out is a hot path (every notifiable event hits it), so query simplicity is decisive. `text[] + GIN` gives constant-time array containment; `jsonb` would require shape-dependent OR branches and a heavier index.
- Equivalent expressivity for v1 needs: `'chapter.*'` ≡ `{chapter: '*'}`. The "category wildcard" use case is fully covered.
- Industry precedent: GitHub Custom Watch is a flat category bitmask; Discord/Slack/YouTube use 3–5 coarse states. No mainstream product reaches for nested filter trees here.
- Validation is a string-membership check against a per-`UnitType` registry: no recursive shape validation.
- Prisma `String[]` is type-safe at the client; `Json` is opaque.
- **Extension escape hatch:** if v2 needs negation or per-channel delivery overrides, ship a separate `channelOverrides Json?` column. The hot fan-out query continues to read `channels` only.

**Alternatives considered:**

- *`Json` channels with shape `{ category: '*' | string[], '*'?: true }`*: rejected per the analysis above. The expressivity gain is only meaningful for negation and per-channel-per-delivery, both of which are non-goals.
- *Bitmask integer*: rejected — requires a centrally-allocated bit-position registry, breaks per-`UnitType` channel namespace independence, and makes the "what does subscription `0x4A2C` mean" debugging story painful.
- *Per-edge enum like `subscribed`/`muted`/`mentions-only` (Discord-style)*: rejected — too coarse for the BOOK case where chapter vs review distinction matters.

### D3. Channel registry lives in `@rezics/contract`, keyed by `UnitType`

```ts
// package/contract/src/subscription/channel-registry.ts
export const CHANNEL_REGISTRY = {
  BOOK: {
    categories: ['chapter', 'review', 'edition', 'metadata'] as const,
    events: [
      'chapter.new', 'chapter.updated', 'chapter.deleted',
      'review.new', 'review.updated',
      'edition.new',
      'metadata.changed', 'cover.changed',
    ] as const,
  },
  USER: {
    categories: ['post', 'review'] as const,
    events: ['post.new', 'review.new'] as const,
  },
  REALM: {
    categories: ['post', 'announcement', 'member'] as const,
    events: ['post.new', 'announcement.new', 'member.joined'] as const,
  },
  TAG:  { categories: ['unit'] as const, events: ['unit.tagged'] as const },
  SHELF:{ categories: ['item'] as const, events: ['item.added', 'item.removed'] as const },
  // ENTITY, POST, etc. — added as their event surfaces are designed
} as const;
```

Validation predicate (used by service write path and by client form layer):

```ts
isValidChannel(targetType, channel) =
  channel === '*'
  || (channel.endsWith('.*') && categories(targetType).includes(channel.slice(0, -2)))
  || events(targetType).includes(channel);
```

**Rationale:** colocating registry with contract types means both backend service validation and frontend channel-picker UI consume the same source of truth. Adding a channel for an existing UnitType is a one-line registry addition; no migration.

### D4. Fan-out resolver lives in a single backend helper; direct-recipient path is preserved

```
EventBus.emit({
  kind: 'chapter.new',
  sourceUnitId: bookId,
  directRecipients?: [],            // optional: pre-known recipients (mention, reply parent, DM peer)
  payload: { chapterId, ... }
})

resolveRecipients(event) =
  directRecipients
  ∪ SELECT subscriberUnitId
    FROM Subscription
    WHERE targetUnitId = sourceUnitId
      AND (channels @> ARRAY[event.kind]
           OR channels @> ARRAY[categoryOf(event.kind) + '.*']
           OR channels @> ARRAY['*'])
```

The resolver returns the recipient set; `notification-feed`'s INSERT path is unchanged from there.

**Rationale:** keeps notification persistence and SSE stream behavior untouched (those specs need only a small addendum about where recipients come from). Per-domain producers stop owning fan-out — they emit a typed event and let the resolver do the routing.

**Alternatives considered:**

- *Embed fan-out inside each domain service*: rejected — the duplication problem the change is meant to solve.
- *Materialized fan-out table (precompute (target, event) → [recipient])*: rejected — write amplification per subscription, and the live query is fast enough with GIN.

### D5. Realm dual-track: join writes both, leave removes both, mute affects only Subscription

```
joinRealm(userId, realmUnitId):
  begin tx
    INSERT RealmMember(realmUnitId, userId, roleKey='member')
    INSERT Subscription(subscriberUnitId=userId, targetUnitId=realmUnitId, channels=['*'])
    Realm.memberCount += 1                    // existing counter
    Unit.subscriberCount[realmUnitId] += 1    // new counter
  commit

leaveRealm(userId, realmUnitId):
  begin tx
    DELETE RealmMember WHERE (realmUnitId, userId)
    DELETE Subscription WHERE (subscriberUnitId, targetUnitId)
    decrement both counters
  commit

muteRealm(userId, realmUnitId):
  DELETE Subscription WHERE (subscriberUnitId, targetUnitId)
  decrement Unit.subscriberCount only

subscribeRealm(userId, realmUnitId):       // public-realm lurker path
  // requires realm.isPublic — service-layer gate, not membership
  INSERT Subscription(...)
  increment Unit.subscriberCount only
```

**Rationale:** the two edges encode different concerns (permission vs attention) and have different acceptable lifecycles. The atomicity is at the action level (join/leave), not at the edge level — composition in service code is fine.

### D6. `Follow` retires; `User.followersCount` / `followingsCount` are recomputed and stay denormalized

- Backfill SQL: `INSERT INTO Subscription (subscriberUnitId, targetUnitId, channels) SELECT followerId, followingId, ARRAY['*'] FROM Follow ON CONFLICT DO NOTHING;`
- Recompute `followersCount` and `followingsCount` from `Subscription` aggregates filtered to USER targets / USER subscribers.
- Drop `Follow` table.
- `/follow/*` endpoints retire; replace with `/subscription/*` (see D7).

**Rationale:** project policy disallows backward-compatible aliases for internal renames. One clean cutover.

### D7. API surface

New domain `subscription` under `package/server/src/subscription/`:

```
POST   /subscription                    body: { targetUnitId, channels? }   default channels=['*']
DELETE /subscription/:targetUnitId
PATCH  /subscription/:targetUnitId      body: { channels }
GET    /subscription/me                 query: ?targetType=BOOK             — my subscriptions
GET    /subscription/check/:targetUnitId                                    — am I subscribed, with channels
GET    /subscription/count/:targetUnitId                                    — subscriberCount (cached)
```

Realm-specific composed endpoints stay in the realm domain but call the subscription service:

```
POST   /realm/:id/join                  → atomic dual-write
POST   /realm/:id/leave                 → atomic dual-delete
POST   /realm/:id/mute                  → subscription-only delete
POST   /realm/:id/unmute                → subscription-only insert
```

`profile-followers-tab` reads come from `GET /subscription/me?targetType=USER` (followings) and a new `GET /user/:id/followers` (which is `Subscription WHERE targetUnitId=:id AND target.type=USER`).

### D8. `subscriberCount` denormalization

A column on `Unit`:

```prisma
model Unit {
  // ...
  subscriberCount Int @default(0)
}
```

Updated by the subscription service in the same transaction as the `Subscription` row insert/delete. No Prisma trigger / DB-side trigger — write is always through the service. The migration recomputes via `UPDATE Unit SET subscriberCount = (SELECT COUNT(*) FROM Subscription WHERE targetUnitId = Unit.id)` once at deployment.

**Rationale:** reading `subscriberCount` is on every Unit detail page render; computing on read would be `COUNT(*)` per render. Denormalization is a tiny write-side cost for a large read-side win. Drift risk is mitigated by a periodic recompute job (out of v1 scope; the migration recompute proves the formula).

## Risks / Trade-offs

- **[Channel registry drift between contract and runtime]** → channels are validated at write time against the registry; an event whose `kind` is not in the registry for the source type is rejected at emit time with a clear error. Tests assert registry coverage for every UnitType that participates in subscriptions.
- **[Counter drift on `subscriberCount` and `followersCount`]** → all writes go through the subscription service, never raw Prisma elsewhere; a `check:convention` rule may forbid direct `Subscription` access from non-subscription services. Migration recomputes from scratch as the source of truth.
- **[Fan-out load on very popular targets (e.g., 1M-watcher book)]** → the fan-out query is GIN-indexed and returns recipient IDs; the notification-row INSERT is the actual cost. Batched INSERT and SSE push are existing concerns of `notification-feed` / `notification-stream` and remain unchanged. If a target's recipient set grows past, say, 100k, the notification-row insertion becomes a queue/worker job — flagged for a future change but not blocking v1.
- **[Realm leave / mute confusion in UI]** → two distinct affordances ("leave realm" vs "mute realm"). Surfaced in the realm header; the design specifies the data layer, not the UI labels — that is a `realm-frontend` follow-on.
- **[Deletion cascades]** → `onDelete: Cascade` on both `Subscription.subscriberUnit` and `Subscription.targetUnit` references to `Unit`. Deleting any Unit cleanly removes all subscription edges touching it. Counter recompute on cascade is non-trivial; the simplest correct path is "never bulk-delete Units in a hot path, and if you do, run the recompute job after." Documented as a constraint.
- **[Rejected `Json` channels — long-tail expressivity]** → if a future product need emerges (negation, per-channel-per-delivery), the design accommodates by adding a new `channelOverrides Json?` column rather than reshaping `channels`. Hot fan-out query stays unchanged.

## Migration Plan

This change cannot apply until `user-namespace-slug` (L3) has shipped and `User.unitId` exists.

1. Prisma migration:
   - Add `Subscription` model.
   - Add `Unit.subscriberCount Int @default(0)` column.
   - Raw SQL: `CREATE INDEX subscription_channels_gin ON "Subscription" USING gin (channels);`.
2. Data backfill (single transaction or batched if `Follow` row count is large):
   - `INSERT INTO Subscription (id, subscriberUnitId, targetUnitId, channels, createdAt) SELECT uuidv7(), followerId, followingId, ARRAY['*'], createdAt FROM Follow;`
   - For every existing `RealmMember`, insert a corresponding `Subscription` row with `channels=['*']` (only if not already present).
   - `UPDATE Unit SET subscriberCount = (SELECT COUNT(*) FROM Subscription WHERE targetUnitId = Unit.id);`
   - `UPDATE User SET followersCount = (SELECT COUNT(*) FROM Subscription s JOIN Unit u ON u.id = s.subscriberUnitId WHERE s.targetUnitId = User.unitId AND u.type = 'USER');`
   - `UPDATE User SET followingsCount = (SELECT COUNT(*) FROM Subscription s JOIN Unit u ON u.id = s.targetUnitId WHERE s.subscriberUnitId = User.unitId AND u.type = 'USER');`
3. Cutover: swap notification-service recipient resolver from per-domain hardcoded paths to the generic `resolveRecipients` helper. Each existing event family is migrated one PR at a time pre-cutover; the final migration removes the old code paths.
4. Drop `Follow` table.
5. Retire `/follow/*` endpoints; ship `/subscription/*` and amended `/realm/*` endpoints in the same release.

**Rollback:** the migration is destructive (drops `Follow`). Rollback path is "restore from backup". This is acceptable per project policy for development-stage breaking cutovers; communicated in the change PR.

## Open Questions

- **OQ1.** Default channels on subscribe action: `['*']` everywhere, or per-target-type smarter defaults (e.g., book defaults to `['chapter.*']` since "every metadata change" is noisy)? Proposed: `['*']` for v1; tune per-type once telemetry is available.
- **OQ2.** Should `member.joined` realm event be a broadcast channel (notify other members when someone joins)? Proposed: include in registry but default channels exclude it; member-join noise is rarely wanted.
- **OQ3.** When a user deletes their account (USER Unit removed), do we want a soft-delete window for outgoing follow targets to be notified? Proposed: no; cascade is silent.
- **OQ4.** Do we expose `subscriberCount` publicly on every Unit type, or gate per type? Proposed: expose universally; clients choose whether to render.
- **OQ5.** Is the `EventBus` a real in-process bus or just a function dispatch? Existing `notification-feed` likely calls notification creation inline today. Proposed: keep inline dispatch through the resolver helper; defer queue/bus introduction to when scale demands it.
