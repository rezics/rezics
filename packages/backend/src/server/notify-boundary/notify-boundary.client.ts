import {
  categoryOf,
  type InternalBroadcastBody,
  type InternalDmBody,
  isValidKind,
  type NotificationPreference,
  notificationPreferenceKeyForKind,
} from "@rezics/contract";
import { and, eq, sql } from "drizzle-orm";
import { Subscription } from "../db/schema";
import { getNotificationPreferencesForUsers } from "../user/service/settings.service";

async function getServerDb() {
  const { db } = await import("../db/client");
  return db;
}

async function getNotifyEnv() {
  const { env } = await import("../env");
  return {
    baseUrl: env.NOTIFY_BASE_URL,
    secret: env.NOTIFY_INTERNAL_SECRET,
  };
}

async function postInternal<T>(
  path: string,
  body: T,
): Promise<{ ok: boolean; data?: unknown }> {
  const { baseUrl, secret } = await getNotifyEnv();
  if (!secret) {
    console.warn(
      "[notify-boundary-client] NOTIFY_INTERNAL_SECRET not set, skipping",
    );
    return { ok: false };
  }

  const res = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-internal-secret": secret,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    console.error(
      `[notify-boundary-client] ${path} failed: ${res.status} ${await res.text()}`,
    );
    return { ok: false };
  }

  return { ok: true, data: await res.json() };
}

export type BroadcastEvent = {
  kind: string;
  sourceUnitId: string;
  directRecipients?: string[];
  directOnly?: boolean;
  actorId?: string | null;
  extra?: unknown;
};

/**
 * Find subscriber Unit ids whose `channels` filter on `Subscription`
 * matches the incoming event. Implements the three-tier wildcard match:
 * exact event, category wildcard, global wildcard.
 *
 * The filter uses PostgreSQL array overlap against the GIN-indexed
 * `Subscription.channels` column.
 */
async function defaultFindSubscriptionMatches(
  sourceUnitId: string,
  kind: string,
): Promise<string[]> {
  const category = categoryOf(kind);
  const categoryWildcard = category ? `${category}.*` : undefined;
  const channelCandidates = [
    kind,
    ...(categoryWildcard ? [categoryWildcard] : []),
    "*",
  ];

  const db = await getServerDb();
  const rows = await db
    .select({ subscriberUnitId: Subscription.subscriberUnitId })
    .from(Subscription)
    .where(
      and(
        eq(Subscription.subscribedUnitId, sourceUnitId),
        sql`${Subscription.channels} && ${channelCandidates}`,
      ),
    );
  return rows.map((r) => r.subscriberUnitId);
}

export type ResolveRecipientsDeps = {
  findSubscriptionMatches: (
    sourceUnitId: string,
    kind: string,
  ) => Promise<string[]>;
};

/**
 * Resolve the final recipient set for a broadcast event.
 *
 * Unions:
 *   - `directRecipients` (explicit-addressed events keep their direct
 *     path — mention target, reply parent, DM peer, etc.)
 *   - subscribers whose `Subscription.channels` matches the event kind for
 *     this event source Unit. Notification source addressing is an operation
 *     endpoint and does not follow `Unit.targetUnitId`.
 *
 * Dedupes through an in-memory `Set` so a subscriber who is also a
 * direct recipient receives exactly one notification row.
 *
 * Dependency-injected for unit testing — production callers omit `deps` and
 * get the Drizzle-backed `defaultFindSubscriptionMatches`.
 */
export async function resolveRecipients(
  event: BroadcastEvent,
  deps: ResolveRecipientsDeps = {
    findSubscriptionMatches: defaultFindSubscriptionMatches,
  },
): Promise<string[]> {
  const set = new Set(event.directRecipients ?? []);
  if (event.directOnly) return Array.from(set);

  const subscriptionMatches = await deps.findSubscriptionMatches(
    event.sourceUnitId,
    event.kind,
  );
  for (const id of subscriptionMatches) set.add(id);
  return Array.from(set);
}

/**
 * Load each recipient's notification preferences in one batched query.
 * Missing users / absent `notifications` map to `undefined` — treated as
 * all-enabled by the filter below.
 */
export type LoadRecipientPreferences = (
  recipientIds: string[],
) => Promise<Map<string, NotificationPreference | undefined>>;

async function defaultLoadRecipientPreferences(
  recipientIds: string[],
): Promise<Map<string, NotificationPreference | undefined>> {
  return getNotificationPreferencesForUsers(recipientIds);
}

/**
 * Drop recipients who disabled the per-kind toggle that gates this event.
 *
 * Per-kind notification preferences are enforced here at dispatch time (when
 * feed/push entries are created), not at read time. Each toggle is on by
 * default; only an explicit `false` suppresses delivery. Ungated kinds (no
 * preference mapping) pass through untouched.
 *
 * Dependency-injected for unit testing — production callers omit
 * `loadPreferences` and get the Drizzle-backed loader.
 */
export async function filterRecipientsByPreference(
  recipientIds: string[],
  kind: string,
  loadPreferences: LoadRecipientPreferences = defaultLoadRecipientPreferences,
): Promise<string[]> {
  const prefKey = notificationPreferenceKeyForKind(kind);
  if (!prefKey || recipientIds.length === 0) return recipientIds;

  const prefs = await loadPreferences(recipientIds);
  return recipientIds.filter((id) => prefs.get(id)?.[prefKey] !== false);
}

/**
 * Emit a notification broadcast event.
 *
 * - Validates `kind` against `KIND_REGISTRY` from `@rezics/contract`. Unknown
 *   kinds are logged and dropped (fire-and-forget ergonomics, matches the
 *   prior `emitNotificationEvent` contract).
 * - Resolves recipients via `resolveRecipients` (direct recipients unioned
 *   with subscription matches).
 * - Skips the HTTP call entirely when the resolved recipient set is empty.
 * - Sends a single batched POST to `/internal/event`; notify persists rows
 *   via `createMany` and SSE-pushes to each connected recipient.
 */
export async function broadcast(
  event: BroadcastEvent,
): Promise<{ ok: boolean; persisted?: number }> {
  if (!isValidKind(event.kind)) {
    console.warn(
      `[notify-boundary-client] dropping unknown notification kind: ${event.kind}`,
    );
    return { ok: false };
  }

  const resolved = await resolveRecipients(event);
  const recipientIds = await filterRecipientsByPreference(resolved, event.kind);
  if (recipientIds.length === 0) {
    return { ok: true, persisted: 0 };
  }

  const body: InternalBroadcastBody = {
    kind: event.kind,
    sourceUnitId: event.sourceUnitId,
    recipientIds,
    actorId: event.actorId ?? null,
    extra: event.extra,
  };

  const result = await postInternal("/internal/event", body);
  const persisted = (result.data as { persisted?: number } | undefined)
    ?.persisted;
  return { ok: result.ok, persisted };
}

export async function sendDm(dm: InternalDmBody) {
  return postInternal("/internal/dm", dm);
}
