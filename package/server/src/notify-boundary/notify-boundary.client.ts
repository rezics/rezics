import type {
  InternalDmBody,
  InternalEventBody,
  SystemEmailBody,
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

export async function emitNotificationEvent(event: InternalEventBody) {
  return postInternal("/internal/event", event);
}

export async function sendDm(dm: InternalDmBody) {
  return postInternal("/internal/dm", dm);
}

export async function notifySystemAndEmail(
  body: SystemEmailBody & { primaryEmail?: string | null },
) {
  return postInternal("/internal/system-email", body);
}
