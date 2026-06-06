import type {
  AllowedReactionKind,
  GivenResponse,
  InternalByUserBody,
  InternalByUserResponse,
  InternalCreateShareResponse,
  InternalCreateResponse,
  InternalRemoveResponse,
} from "@rezics/contract/reaction";
import { normalizeReactionScopeKey } from "@rezics/contract/reaction";
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

async function getPublic<T>(
  path: string,
  query: Record<string, string | number | undefined>,
): Promise<T> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined) continue;
    params.append(key, String(value));
  }
  const qs = params.toString();
  const url = `${baseUrl}${path}${qs ? `?${qs}` : ""}`;
  const res = await fetch(url, { method: "GET" });
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
  reaction: AllowedReactionKind,
  scopeKey?: string,
): Promise<InternalCreateResponse> {
  return postInternal<InternalCreateResponse>("/internal/create", {
    userId,
    targetId,
    reaction,
    scopeKey: normalizeReactionScopeKey(scopeKey),
  });
}

/**
 * Remove a reaction via the reaction service's internal API.
 */
export async function removeReaction(
  userId: string,
  targetId: string,
  reaction: AllowedReactionKind,
  scopeKey?: string,
): Promise<InternalRemoveResponse> {
  return postInternal<InternalRemoveResponse>("/internal/remove", {
    userId,
    targetId,
    reaction,
    scopeKey: normalizeReactionScopeKey(scopeKey),
  });
}

export async function recordShare(
  userId: string,
  targetId: string,
): Promise<InternalCreateShareResponse> {
  return postInternal<InternalCreateShareResponse>("/internal/share", {
    userId,
    targetId,
  });
}

/**
 * List a user's own reaction events via the reaction service's public endpoint.
 * Used by the profile Given view; the main server is responsible for any
 * privacy gating before calling this.
 */
export async function listGivenReactions(query: {
  userId: string;
  reactions?: string;
  scopeKey?: string;
  cursor?: string;
  limit?: number;
}): Promise<GivenResponse> {
  return getPublic<GivenResponse>("/reaction/given", query);
}

/**
 * List reactions on a given target id set via the reaction service's internal
 * endpoint. Used by the profile Received view.
 */
export async function listByUser(
  body: InternalByUserBody,
): Promise<InternalByUserResponse> {
  return postInternal<InternalByUserResponse>("/internal/by-user", body);
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
