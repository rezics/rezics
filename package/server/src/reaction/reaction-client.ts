import { env } from "../env";

const baseUrl = env.REACTION_BASE_URL;

/**
 * Call reaction service's cleanup endpoint to delete all reactions for a target.
 * Used when a Unit is deleted.
 */
export async function cleanupReactions(
  targetId: string,
): Promise<{ ok: boolean }> {
  const secret = env.REACTION_INTERNAL_SECRET;
  if (!secret) {
    console.warn(
      "[reaction-client] REACTION_INTERNAL_SECRET not set, skipping cleanup",
    );
    return { ok: false };
  }

  try {
    const res = await fetch(`${baseUrl}/internal/cleanup`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-internal-secret": secret,
      },
      body: JSON.stringify({ targetId }),
    });

    if (!res.ok) {
      console.error(
        `[reaction-client] Cleanup failed: ${res.status} ${await res.text()}`,
      );
      return { ok: false };
    }

    return { ok: true };
  } catch (e) {
    console.error("[reaction-client] Cleanup call failed:", e);
    return { ok: false };
  }
}
