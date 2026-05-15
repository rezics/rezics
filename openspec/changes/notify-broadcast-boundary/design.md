## Context

The notify service has been live as a process for some time but is structurally disconnected from the rest of the system. Two failure modes coexist:

1. **The frontend cannot talk to notify at all.** The session token is in an `HttpOnly` cookie (set by `package/server/src/auth-boundary/auth-boundary.service.ts` per the security migration), but notify's `requireUser` macro reads only `Authorization: Bearer`. There is no SSE client, no notification-list hook, no React surface that consumes notify's REST or stream endpoints. `NotificationPage.tsx` is `<AccentBarWithText text="Notification" />`. `NotificationTabSection.tsx` is `<div>NotificationTabSection</div>`.

2. **The boundary contract is shaped wrong for the next change.** `engagement-subscription` introduces a generic `{ kind, sourceUnitId }` event whose recipients are computed from a `Subscription` table that lives in the **server** database. Notify cannot reach that table — the two services have separate Postgres instances. Yet `/internal/event` today is single-recipient, locked to a closed `NotificationType` enum, and assumes the producer hardcodes the recipient. Engagement-subscription would have nowhere to send a fanned-out event without first reshaping this boundary.

This change closes both failure modes in one batch, because they share infrastructure: the same cookie scope decision unblocks the frontend client, the same cookie scope makes the new boundary contract usable from the browser, and the boundary contract reshape is the one that engagement-subscription's resolver layer extends.

The dependency is asymmetric: this change must land **before** `engagement-subscription`, but engagement-subscription does not need to land before any other in-flight work.

## Goals / Non-Goals

**Goals:**

- Make notify reachable from the browser using the existing `HttpOnly` `rezics-session-token` cookie, without weakening CSRF protection.
- Codify the cross-service cookie trust boundary as a first-class capability spec (`subdomain-trust-boundary`) so the four invariants are documented, not folklore.
- Land a broadcast-aware boundary contract (`{ kind, sourceUnitId, recipientIds[], actorId?, extra? }`) and a server-side `notifyBoundary.broadcast(event)` helper whose body engagement-subscription extends.
- Migrate notify's `Notification` row schema from `(type enum, entityType, entityId, meta)` to `(kind String, sourceUnitId String, extra Json?)` in one clean cutover.
- Wire notify into the app: TanStack Query hooks, SSE client, real notification page, header bell badge with unread count.
- Migrate the four existing emit call sites in the same change — no compat shim.

**Non-Goals:**

- DM permission rules and DM inbox UI — these depend on `Subscription` semantics and ship with `engagement-subscription`.
- `notify-system-email` flow — independent capability with its own internal endpoint, unchanged.
- Hotness ranking, queue/EventBus abstraction, dead-letter, retry semantics — deferred.
- Per-channel delivery overrides (in-app vs email vs push) — `notify-system-email` already covers email; per-edge override is non-goal here and in `engagement-subscription`.

## Decisions

### D1. Cookie scope: `Domain=.rezics.com`, `SameSite=Lax`, `HttpOnly`

```
prod cookie:  rezics-session-token=…; Domain=.rezics.com; Path=/; HttpOnly; SameSite=Lax; Secure
dev cookie:   rezics-session-token=…;                     Path=/; HttpOnly; SameSite=Lax
```

The math:

- `book.rezics.com` and `notify.rezics.com` share the registrable domain `rezics.com`. By the SameSite definition (eTLD+1), they are **same-site cross-origin**.
- `SameSite=Lax` allows browser-mediated requests between same-site origins, including `fetch`, XHR, and `EventSource` with `withCredentials: true`. So cross-origin calls from `book.rezics.com` to `notify.rezics.com` carry the cookie under Lax.
- `SameSite=Lax` continues to **block** cross-site requests from `evil.com` to `notify.rezics.com` for non-safe methods (POST, PUT, DELETE) and for cross-site `fetch` regardless of method. CSRF protection is preserved.
- `localhost:35001` and `localhost:3002` are same-site (cookies don't carry port). Lax allows cross-port `fetch`. Browsers permit `Secure=false` for `localhost` specifically.

**Rationale:** This is the architecturally cleanest path for cross-service state in a `*.rezics.com` topology. It removes the need for a reverse proxy, removes the need for `SameSite=None; Secure` (which would lose CSRF protection from the browser), and removes per-request CSRF tokens.

**Alternatives considered:**

- *Reverse-proxy notify under `book.rezics.com/notify`*: rejected. Adds an infra component (nginx config or Vite middleware in dev), introduces a single point of failure, and obscures the service boundary. Subdomain scoping with `Lax` achieves the same goal without infra.
- *`SameSite=None; Secure` + CSRF token*: rejected. Loses browser-level CSRF protection, requires a token-issuance endpoint and double-submit cookie pattern in every mutation, and adds a class of bugs (token expiry, mismatch on tab restore).
- *Per-service login (separate cookie per subdomain)*: rejected. Requires a synchronization protocol or repeated login. Defeats the purpose of having one identity.

### D2. Four invariants for `subdomain-trust-boundary`

The cookie scope is safe **only** if all four hold. They become the requirements of the new capability.

1. **No untrusted content on any `*.rezics.com` subdomain.** User-uploaded HTML, third-party widgets, file gists, embedded iframes from external authors — all go on a separate registrable domain (the `googleusercontent.com` pattern). Otherwise that subdomain's JS can call notify (or any other first-party service) with the user's session cookie. `HttpOnly` prevents *token theft* but does not prevent *session abuse*.

2. **DNS hygiene: no dangling subdomain CNAMEs.** A subdomain CNAME pointing to a deprovisioned Heroku/Vercel/Render app can be claimed by an attacker. Once claimed, the attacker controls an `*.rezics.com` origin and inherits all the trust. Mitigation: periodic audit of DNS records against the live service inventory; ideally automated monitoring (Project Discovery's `nuclei` or similar takeover scanners).

3. **Logout symmetry.** Cookie deletion MUST use the same `Domain=.rezics.com` attribute it was set with. Otherwise the cookie persists on sibling subdomains after logout. Easy to miss; covered by a unit test that asserts the `Set-Cookie` header on the logout response carries the same `Domain` attribute as session creation.

4. **XSS on any first-party origin is session-equivalent.** The trust-boundary model assumes first-party origins are not compromised. Standard XSS defenses (CSP, escape-on-render, React's automatic escaping, `dangerouslySetInnerHTML` audit) still apply per service. Cookie scoping is not an XSS mitigation.

These invariants are not specific to notify. They are about the trust boundary the cookie defines, so the spec is a separate capability that all first-party services depend on.

### D3. Boundary contract: pre-resolved `recipientIds[]`

```ts
// before
POST /internal/event
{ recipientId: string, type: NotificationType, actorId?: string,
  entityType: string, entityId: string, meta?: Json }

// after
POST /internal/event
{ kind: string,            // dot-namespaced, registry-validated
  sourceUnitId: string,    // the Unit the event is "about"
  recipientIds: string[],  // pre-resolved by caller (server)
  actorId?: string,
  extra?: Json }
```

**Why pre-resolved on the caller side:**

- Subscription table lives in **server DB**. Notify cannot query it. Pushing the resolution responsibility to the caller is the only architecturally clean path.
- The same shape works for both broadcast and direct-addressed events: a mention's `recipientIds` is `[mentionedUserId]`; a `chapter.new` is `[u1, u2, u3, …]`. No fork in the contract.
- Batching is natural: notify does one `prisma.notification.createMany({ data: rows })` instead of N round-trips. SSE fan-out iterates the in-process subscriber map once.

**Server-side helper:**

```ts
// package/server/src/notify-boundary/notify-boundary.client.ts (this change)
export async function broadcast(event: {
  kind: string;
  sourceUnitId: string;
  directRecipients?: string[];
  actorId?: string;
  extra?: Json;
}) {
  const recipientIds = await resolveRecipients(event);
  if (recipientIds.length === 0) return { ok: true, persisted: 0 };
  return postInternal('/internal/event', { ...event, recipientIds });
}

// v1 body — engagement-subscription extends this
async function resolveRecipients(event): Promise<string[]> {
  return Array.from(new Set(event.directRecipients ?? []));
}
```

Engagement-subscription replaces the body of `resolveRecipients` to union with the GIN-indexed Subscription query (the design D4 of that change). The signature locked in here is the contract.

**Alternatives considered:**

- *Notify queries server's internal API for recipient resolution*: rejected. Round-trip per event, coupling, and notify becomes aware of subscription semantics — which is exactly the wrong direction.
- *Replicate Subscription into notify DB*: rejected. Cross-DB consistency burden far outweighs the benefit.
- *Single-recipient body, server calls notify N times*: rejected. Latency and write amplification on viral events.

### D4. `KIND_REGISTRY` is flat, keyed by event kind

```ts
// package/contract/src/notification/kind-registry.ts
export const KIND_REGISTRY = {
  'reaction.like':     { aggregatable: true,  category: 'reaction' },
  'reaction.favorite': { aggregatable: true,  category: 'reaction' },
  'follow.new':        { aggregatable: true,  category: 'follow' },
  'comment.new':       { aggregatable: false, category: 'comment' },
  'mention.new':       { aggregatable: false, category: 'mention' },
  'system.notice':     { aggregatable: false, category: 'system' },
  'invitation.new':    { aggregatable: false, category: 'invitation' },
} as const;

export type NotificationKind = keyof typeof KIND_REGISTRY;

export function isValidKind(kind: string): kind is NotificationKind {
  return kind in KIND_REGISTRY;
}

export function isAggregatable(kind: string): boolean {
  return KIND_REGISTRY[kind as NotificationKind]?.aggregatable ?? false;
}
```

**Rationale for flat (not per-`UnitType`):**

- Aggregation is a **per-kind** property, not a per-source-type property. A `reaction.like` aggregates whether the source is a post Unit, a comment Unit, or a chapter Unit.
- The `subscription` channel registry is per-`UnitType` because *channels* are semantic to the target type ("a BOOK has chapter events"). The *kind* of the resulting notification is independent — `chapter.new` is `chapter.new` regardless of which book it came from.
- A flat map is dead simple to validate: `kind in KIND_REGISTRY`. No nested traversal.
- Engagement-subscription extends this map with `chapter.new`, `chapter.updated`, `review.new`, `review.updated`, `member.joined`, `post.new`, `announcement.new`, `item.added`, `item.removed`, `unit.tagged`, etc. as a one-line entry per kind.

**Validation:** `notifyBoundary.broadcast` rejects unknown `kind` at emit time (server-side, before HTTP call). Notify also re-validates (defense in depth).

### D5. Notification row schema migration: clean cutover

```prisma
// before
model Notification {
  id          String           @id @default(dbgenerated("uuidv7()")) @db.Uuid
  recipientId String           @db.Uuid
  actorId     String?          @db.Uuid
  type        NotificationType
  entityType  String
  entityId    String
  meta        Json?
  read        Boolean          @default(false)
  readAt      DateTime?
  createdAt   DateTime         @default(now())

  @@index([recipientId, read])
  @@index([recipientId, type, entityType, entityId])
  @@index([recipientId, createdAt(sort: Desc)])
}

// after
model Notification {
  id           String    @id @default(dbgenerated("uuidv7()")) @db.Uuid
  recipientId  String    @db.Uuid
  actorId      String?   @db.Uuid
  kind         String    @db.VarChar(64)
  sourceUnitId String    @db.Uuid
  extra        Json?
  read         Boolean   @default(false)
  readAt       DateTime?
  createdAt    DateTime  @default(now())

  @@index([recipientId, read])
  @@index([recipientId, kind, sourceUnitId])
  @@index([recipientId, createdAt(sort: Desc)])
}
```

`NotificationType` enum is dropped. `meta` → `extra` for server-schema convention alignment (eleven `extra Json?` columns across `package/server/prisma/schema.prisma`, zero `meta`). `kind` is `VarChar(64)` for index efficiency; the registry caps practical kinds well under that.

**Migration strategy:** notify DB is dev-only. The migration is a destructive ALTER (or `prisma migrate reset` + new init). No data backfill. The migration runs as part of the deploy and any existing dev rows are discarded. The change PR notes this in its rollout instructions.

**Aggregation key:** `(recipientId, kind, sourceUnitId)`. The `KIND_REGISTRY[kind].aggregatable` predicate decides whether a row goes into the grouped query or the individual query. The hardcoded `AGGREGATABLE_TYPES = ['LIKE', 'FAVORITE', 'FOLLOW']` constant is removed.

### D6. WS DM auth: cookie on handshake

The browser sends cookies on the WS upgrade request automatically (under SameSite=Lax for same-site cross-origin upgrades). Notify's WS handler reads `headers.cookie`, extracts `rezics-session-token`, and verifies it the same way the HTTP `requireUser` macro does.

The legacy `?token=<jwt>` query parameter path is removed. Per project policy on dev-stage breaking changes, no compat — the frontend never reached this WS endpoint anyway (no DM client exists yet), and the only caller would be local test scripts which update in the same PR.

**Why not keep `?token=` as a fallback:** query-param tokens land in access logs, browser history, and HTTP referrer headers. Removing them is a security improvement with no migration cost in this codebase.

### D7. Frontend SSE client: `EventSource` with `withCredentials`

```ts
// package/api/src/notification/use-notification-stream.ts
const es = new EventSource(`${NOTIFY_BASE_URL}/stream`, { withCredentials: true });
es.onmessage = (ev) => {
  const raw = JSON.parse(ev.data);
  queryClient.invalidateQueries({ queryKey: ['notifications'] });
  queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
};
```

`withCredentials: true` is required for cross-origin cookie sending. Notify's CORS config must set `credentials: true` and an explicit origin (no `*`). Both already roughly true; the change is to add the credentials flag and lock down the origin allow-list to `https://*.rezics.com` in prod.

**Reconnection:** `EventSource` auto-reconnects on transient failure. On reconnect the client re-fetches `/notifications` to backfill any events missed during the gap. This is implicit — the invalidation pattern above naturally re-fetches on stream events.

**Mount point:** the SSE hook mounts at app shell level, after authenticated state is confirmed (post-login). It unmounts on logout (which clears the cookie; the EventSource then errors out and stays closed).

### D8. CORS allow-list

```ts
// package/notify/src/index.ts
cors({
  origin: isDev
    ? ['http://localhost:35001', 'http://localhost:35002', 'http://localhost:8000']
    : (origin) => origin?.endsWith('.rezics.com') || origin === 'https://rezics.com',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['content-type', 'authorization', 'x-internal-secret'],
  maxAge: 600,
})
```

`credentials: true` is the new addition. The origin allow-list shape is largely as-is; the prod branch is widened from a hardcoded list to a registrable-domain check so future first-party subdomains don't require a notify config change.

**Why function-form origin check:** `@elysiajs/cors` accepts a function. Wildcard subdomain matching is not built-in for the array form. The function form is concise and explicit.

### D9. Migration of the four existing emit call sites

| File | Today | After |
|---|---|---|
| `reaction-boundary/reaction-boundary.api.ts` | `emitNotificationEvent({ recipientId: unit.userId, type: NotificationType.LIKE, actorId, entityType: 'unit', entityId: targetId, meta: {} })` | `notifyBoundary.broadcast({ kind: 'reaction.like', sourceUnitId: targetId, directRecipients: [unit.userId], actorId, extra: {} })` |
| `user/service/user.service.ts` (follow path) | `emitNotificationEvent({ recipientId: followingId, type: NotificationType.FOLLOW, actorId: followerId, entityType: 'user', entityId: followingId })` | `notifyBoundary.broadcast({ kind: 'follow.new', sourceUnitId: <followingUnitId>, directRecipients: [followingId], actorId: followerId })` |
| `unit/work-link.service.ts` | per-flow (work-link claim notifications) | per-flow with `kind: 'work-link.<event>'` (registry entries added) |
| `unit/work-link-claim.service.ts` | per-flow | per-flow with appropriate `kind` |

Each migration is mechanical but locally distinct. The task list enumerates them.

`emitNotificationEvent` is removed from `notify-boundary.client.ts`. `sendDm` and `notifySystemAndEmail` stay (DM permission migration moves to `engagement-subscription`; system-email is a separate capability).

## Risks / Trade-offs

- **[Sibling subdomain compromise → session abuse]** — Mitigated by `subdomain-trust-boundary` invariant 1 (no user content) + invariant 2 (DNS hygiene). The trust model is explicit; if someone proposes hosting user-uploaded HTML on `gist.rezics.com`, the spec catches it at review time.
- **[`prisma.notification.createMany` skipping middleware/extensions]** — `createMany` does not return created rows by default and bypasses some Prisma extensions. We are not using extensions on this table; the SSE fan-out reads `recipientIds` from the request body, not from the insert result, so no row IDs need to be returned to push. Acceptable.
- **[`EventSource` reconnect storm on flaky network]** — `EventSource` backoff is browser-default (~3s, can vary). On mass disconnect (e.g., notify restart) every connected client reconnects within ~3s. Notify's in-process subscriber map handles this fine at current scale; flagged for a future change if connection counts grow past ~10k.
- **[Cookie not sent in dev because of port mismatch + SameSite=Lax]** — Verified: `localhost:35001` and `localhost:3002` are same-site (eTLD+1 = `localhost`), Lax sends cookies on cross-port `fetch`. `withCredentials: true` is still required on the EventSource.
- **[CORS preflight on `EventSource`]** — `EventSource` only does GET, no preflight. `withCredentials` requires `Access-Control-Allow-Credentials: true` on the response and a non-wildcard `Access-Control-Allow-Origin`. The function-form origin check satisfies this.
- **[`createMany` + 100k recipients in one INSERT]** — Postgres handles this fine for the foreseeable future. If a single event ever fans out to ~1M recipients, the insert and subsequent SSE iteration become a queue-worker concern. Out of scope here; flagged.
- **[Logout doesn't clear cookie on sibling subdomains]** — Covered by trust-boundary invariant 3; tested in the auth-boundary unit suite.

## Open Questions

- **OQ1.** Should `notifyBoundary.broadcast` accept `directRecipients` as a string array of *Unit IDs* or *User IDs*? After `user-namespace-slug`, `User.unitId === Unit.id where type=USER`, so they're equal — but pre-L3 they're different. **Proposed:** Unit IDs throughout. v1 callers pass `unit.userId` which today is the User PK; after L3 they pass the same value which by then is the User's Unit ID. No code change needed at the cutover; the rename happens in L3.
- **OQ2.** Where does `useNotificationStream` mount exactly? `AuthenticatedSection` and `MainNavigation` are candidates; the app shell layout might be cleaner. **Proposed:** mount inside `MainNavigation` (already has the bell icon; co-locates the stream with its consumer). Re-evaluate if multiple consumers materialize.
- **OQ3.** Do we expose `kind` strings on the frontend wire as-is, or wrap them in a typed union derived from `KIND_REGISTRY`? **Proposed:** typed union via `NotificationKind` from the registry; consumers do exhaustive switches without string magic.
- **OQ4.** `extra Json?` carries renderer payload (entity title snapshot, deep-link target). Do we type the `extra` per kind? **Proposed:** keep `Json?` at the storage layer; let the contract package declare per-kind `extra` types as a discriminated union (`type ReactionLikeExtra = { unitTitle: string; … }`). Validation is best-effort at the rendering layer.

## Migration Plan

1. Land `subdomain-trust-boundary` capability spec — pure documentation; no code.
2. Update server cookie builder to add `Domain=.rezics.com` in prod; verify `Set-Cookie` header in `auth-public.api.test.ts`. Update logout to use the same `Domain`.
3. Update notify CORS config: `credentials: true`, function-form origin check.
4. Update notify `requireUser` macro: read token from `Authorization` OR `Cookie`.
5. Add `KIND_REGISTRY` to `@rezics/contract`. Update `internalEventBodySchema` (rename to `internalBroadcastBodySchema`). Remove `AGGREGATABLE_TYPES`.
6. Notify Prisma migration: drop `NotificationType` enum, drop `type`/`entityType`/`entityId`, add `kind`/`sourceUnitId`, rename `meta`→`extra`. Recreate indexes. Run `prisma migrate reset` + new init in dev (notify DB is dev-only).
7. Notify `internal.api.ts`: rewrite `/internal/event` handler for the broadcast body; use `createMany`; iterate SSE fan-out.
8. Notify `notification.service.ts` + mapper: rewrite aggregation by `(kind, sourceUnitId)`; `KIND_REGISTRY`-driven aggregatability.
9. Notify `dm/dm.api.ts` WS handler: read cookie from upgrade request; remove `?token=` path.
10. Server `notify-boundary/notify-boundary.client.ts`: implement `broadcast(event)` with stub `resolveRecipients`; remove `emitNotificationEvent`.
11. Migrate the four existing call sites in one PR, alongside steps 5–10.
12. `package/api/src/notification/`: hooks + query options.
13. `package/api/src/notification/use-notification-stream.ts`: SSE client hook.
14. `package/app`: real `NotificationPage`, `NotificationTabSection`, header bell badge; mount `useNotificationStream` in `MainNavigation`.
15. Validation: `tsc --noEmit` per package; `bun test`; manual UI smoke (notify is up, SSE connects, emit a reaction → notification appears live, mark as read clears badge).

**Rollback:** notify Prisma migration is destructive. Rollback path is "restore from backup" or "re-run prior migrations + `prisma migrate reset`". Acceptable per project policy for dev-stage breaking cutovers; called out in the change PR.
