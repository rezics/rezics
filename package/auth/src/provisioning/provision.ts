import { env } from "../env";

export async function provisionUserOnServer({
  unitId,
  slug,
  name,
}: {
  unitId: string;
  slug: string;
  name: string;
}): Promise<void> {
  const serverBaseUrl = env.SERVER_BASE_URL;
  const secret = env.SERVER_INTERNAL_SECRET;
  if (!secret) {
    console.warn(
      "[provisioning] SERVER_INTERNAL_SECRET not set, skipping provisioning",
    );
    return;
  }

  const response = await fetch(`${serverBaseUrl}/internal/users/provision`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-internal-secret": secret,
    },
    body: JSON.stringify({ unitId, slug, name }),
  });

  if (!response.ok) {
    console.error(
      `[provisioning] Provisioning failed: ${response.status} ${response.statusText}`,
    );
    throw new Error("User provisioning on server failed");
  }
}
