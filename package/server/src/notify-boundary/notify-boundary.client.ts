import {
  type InternalBroadcastBody,
  type InternalDmBody,
  isValidKind,
  type SystemEmailBody,
} from "@rezics/contract";
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
  actorId?: string | null;
  extra?: unknown;
};

/**
 * Resolve the final recipient set for a broadcast event.
 *
 * v1: returns a deduplicated copy of `directRecipients`. This is the contract
 * surface that the `engagement-subscription` change extends: it unions the
 * `directRecipients` with the result of a `Subscription` query against the
 * server DB (GIN-indexed), keyed by `kind` channel and `sourceUnitId`.
 *
 * Keep this function pure and side-effect-free so engagement-subscription's
 * extension stays predictable.
 */
async function resolveRecipients(event: BroadcastEvent): Promise<string[]> {
  return Array.from(new Set(event.directRecipients ?? []));
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
  const persisted = (result.data as { persisted?: number } | undefined)?.persisted;
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
