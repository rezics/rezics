import { env } from "../env";

/**
 * Resolve the owner of a target unit via the main server's internal API.
 * Returns the ownerId or null if resolution fails.
 */
async function resolveOwner(targetId: string): Promise<string | null> {
  const secret = env.SERVER_INTERNAL_SECRET;
  if (!secret) {
    console.warn("[notify-client] SERVER_INTERNAL_SECRET not set, skipping owner resolution");
    return null;
  }

  try {
    const res = await fetch(
      `${env.SERVER_BASE_URL}/internal/units/owner?id=${encodeURIComponent(targetId)}`,
      {
        headers: { "x-internal-secret": secret },
      },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { ownerId: string };
    return data.ownerId;
  } catch (e) {
    console.error("[notify-client] Owner resolution failed:", e);
    return null;
  }
}

/**
 * Send a notification event to the Notify service.
 */
async function sendNotification(payload: {
  recipientId: string;
  type: string;
  actorId: string;
  entityType: string;
  entityId: string;
  meta: Record<string, unknown>;
}): Promise<void> {
  const secret = env.NOTIFY_INTERNAL_SECRET;
  if (!secret) {
    console.warn("[notify-client] NOTIFY_INTERNAL_SECRET not set, skipping notification");
    return;
  }

  try {
    const res = await fetch(`${env.NOTIFY_BASE_URL}/internal/event`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-internal-secret": secret,
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      console.error(
        `[notify-client] Notification failed: ${res.status} ${await res.text()}`,
      );
    }
  } catch (e) {
    console.error("[notify-client] Notification send failed:", e);
  }
}

/**
 * Emit a reaction notification: resolve owner, then notify if owner != actor.
 * Fully fire-and-forget — never throws.
 */
export async function emitReactionNotification(
  actorId: string,
  targetId: string,
): Promise<void> {
  const ownerId = await resolveOwner(targetId);
  if (!ownerId || ownerId === actorId) return;

  await sendNotification({
    recipientId: ownerId,
    type: "LIKE",
    actorId,
    entityType: "unit",
    entityId: targetId,
    meta: {},
  });
}
