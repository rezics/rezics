import type { VerifiedRegistrationFacts } from "@rezics/contract";
import { env } from "@/env";

function getInternalAuthBaseUrl(): string {
  return env.AUTH_INTERNAL_BASE_URL;
}

export async function fetchVerifiedRegistrationFacts(
  authUserId: string,
): Promise<VerifiedRegistrationFacts | null> {
  const url = new URL(
    "/internal/registration/verified-facts",
    getInternalAuthBaseUrl(),
  );
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-internal-secret": env.AUTH_INTERNAL_TOKEN_GATEWAY_SECRET,
    },
    body: JSON.stringify({ authUserId }),
  });

  if (!response.ok) return null;
  const body = (await response.json()) as {
    success?: boolean;
    facts?: VerifiedRegistrationFacts;
  };
  return body.success && body.facts ? body.facts : null;
}

export async function projectSlugToAuth(input: {
  authUserId: string;
  slug: string;
}): Promise<boolean> {
  const url = new URL("/internal/users/project-slug", getInternalAuthBaseUrl());
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-internal-secret": env.AUTH_INTERNAL_TOKEN_GATEWAY_SECRET,
    },
    body: JSON.stringify(input),
  });

  return response.ok;
}

export async function revokeAuthSessionsForAuthUser(input: {
  authUserId: string;
  reason: string;
}): Promise<{ ok: boolean; revokedSessions: number | null }> {
  const url = new URL(
    "/internal/users/revoke-sessions",
    getInternalAuthBaseUrl(),
  );
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-internal-secret": env.AUTH_INTERNAL_TOKEN_GATEWAY_SECRET,
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) return { ok: false, revokedSessions: null };

  const body = (await response.json()) as {
    success?: boolean;
    revokedSessions?: number;
  };

  return {
    ok: body.success === true,
    revokedSessions:
      typeof body.revokedSessions === "number" ? body.revokedSessions : null,
  };
}
