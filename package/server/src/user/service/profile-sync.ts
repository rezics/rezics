import { env } from "@/env";

export async function syncProfileToAuth(payload: {
  unitId: string;
  name?: string;
  slug?: string;
  avatar?: string | null;
}): Promise<void> {
  const authBaseUrl = env.AUTH_BASE_URL;
  const secret = env.SERVER_INTERNAL_SECRET;
  if (!secret) return;

  try {
    await fetch(`${authBaseUrl}/internal/users/sync`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-secret": secret,
      },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.error("[profile-sync] Failed to sync profile to auth:", err);
  }
}
