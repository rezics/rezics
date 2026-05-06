import type {
  InternalCreateResponse,
  InternalRemoveResponse,
} from "@rezics/contract/reaction";
import { env } from "../env";

const baseUrl = env.REACTION_BASE_URL;

async function postInternal<T>(path: string, body: unknown): Promise<T> {
  const secret = env.REACTION_INTERNAL_SECRET;
  if (!secret) {
    throw new Error(
      "[reaction-boundary-client] REACTION_INTERNAL_SECRET not set",
    );
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
    const text = await res.text();
    throw new Error(
      `[reaction-boundary-client] ${path} failed: ${res.status} ${text}`,
    );
  }

  return res.json() as Promise<T>;
}

/**
 * Create a reaction via the reaction service's internal API.
 * Returns the reaction DTO and whether it was newly created.
 */
export async function createReaction(
  userId: string,
  targetId: string,
  reaction: string,
): Promise<InternalCreateResponse> {
  return postInternal<InternalCreateResponse>("/internal/create", {
    userId,
    targetId,
    reaction,
  });
}

/**
 * Remove a reaction via the reaction service's internal API.
 */
export async function removeReaction(
  userId: string,
  targetId: string,
  reaction: string,
): Promise<InternalRemoveResponse> {
  return postInternal<InternalRemoveResponse>("/internal/remove", {
    userId,
    targetId,
    reaction,
  });
}

/**
 * Call reaction service's cleanup endpoint to delete all reactions for a target.
 * Used when a Unit is deleted. Fire-and-forget — does not throw.
 */
export async function cleanupReactions(
  targetId: string,
): Promise<{ ok: boolean }> {
  try {
    await postInternal("/internal/cleanup", { targetId });
    return { ok: true };
  } catch (e) {
    console.error("[reaction-boundary-client] Cleanup call failed:", e);
    return { ok: false };
  }
}
