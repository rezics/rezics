import {
  categoryOf,
  type InternalBroadcastBody,
  type InternalDmBody,
  isValidKind,
  type SystemEmailBody,
} from "@rezics/contract";
import { prisma } from "#/prisma/client";
import { env } from "../env";

const baseUrl = env.NOTIFY_BASE_URL;

async function postInternal<T>(
  path: string,
  body: T,
): Promise<{ ok: boolean; data?: unknown }> {
  const secret = env.NOTIFY_INTERNAL_SECRET;
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
 * matches the incoming event. Implements the three-tier wildcard match
 * from design D4: exact event, category wildcard, global wildcard.
 *
 * The filter goes through Prisma's `{ has: 'x' }` operator which emits
 * `channels @> ARRAY['x']` under the hood and is served by the GIN
 * index `subscription_channels_gin` created in the migration.
 */
async function defaultFindSubscriptionMatches(
  targetUnitId: string,
  kind: string,
): Promise<string[]> {
  const category = categoryOf(kind);
  const categoryWildcard = category ? `${category}.*` : undefined;

  const rows = await prisma.subscription.findMany({
    where: {
      targetUnitId,
      OR: [
        { channels: { has: kind } },
        ...(categoryWildcard ? [{ channels: { has: categoryWildcard } }] : []),
        { channels: { has: "*" } },
      ],
    },
    select: { subscriberUnitId: true },
  });
  return rows.map((r) => r.subscriberUnitId);
}

export type ResolveRecipientsDeps = {
  findSubscriptionMatches: (
    targetUnitId: string,
    kind: string,
  ) => Promise<string[]>;
};

/**
 * Resolve the final recipient set for a broadcast event.
 *
 * Unions:
 *   - `directRecipients` (explicit-addressed events keep their direct
 *     path — mention target, reply parent, DM peer, etc.)
 *   - subscribers whose `Subscription.channels` matches the event kind
 *     via the three-tier wildcard query.
 *
 * Dedupes through an in-memory `Set` so a subscriber who is also a
 * direct recipient receives exactly one notification row.
 *
 * Dependency-injected for unit testing — production callers omit
 * `deps` and get the Prisma-backed `defaultFindSubscriptionMatches`.
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
 * Emit a notification broadcast event.
 *
 * - Validates `kind` against `KIND_REGISTRY` from `@rezics/contract`. Unknown
 *   kinds are logged and dropped (fire-and-forget ergonomics, matches the
 *   prior `emitNotificationEvent` contract).
 * - Resolves recipients via `resolveRecipients` (v1: directRecipients only;
 *   engagement-subscription extends this).
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

  const recipientIds = await resolveRecipients(event);
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

export async function notifySystemAndEmail(
  body: SystemEmailBody & { primaryEmail?: string | null },
) {
  return postInternal("/internal/system-email", body);
}
