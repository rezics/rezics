import {
  authTokenResponseSchema,
  getSessionResponseSchema,
  getSessionStateResponseSchema,
  listSessionsResponseSchema,
  revokeSessionBodySchema,
} from "@rezics/contract";
import { listEnabledSocialProviderIds } from "../auth/providers";
import { handleAuthRequest } from "../auth/routes";
import { coreInstance } from "../core";
import { env } from "../env";
import { jsonRequestBody, jsonResponse } from "./docs";

async function forwardAuthRequest(
  request: Request,
  path: string,
): Promise<Response> {
  const url = new URL(request.url);
  url.pathname = path;
  return handleAuthRequest(new Request(url, request));
}

async function getSessionStateResponse(request: Request): Promise<Response> {
  const response = await forwardAuthRequest(
    request,
    `${env.AUTH_OPENAPI_ROUTER_PREFIX}/get-session`,
  );

  if (!response.ok) {
    return response;
  }

  const sessionData = (await response.json()) as Partial<{
    session: {
      id: string;
      token: string;
      expiresAt: string;
      userId: string;
    };
    user: {
      id: string;
      name: string;
      role: string;
      email: string;
      emailVerified: boolean;
      image?: string | null;
      createdAt: string;
      updatedAt: string;
    };
  }> &
    Record<string, unknown>;

  if (!sessionData.session || !sessionData.user?.id) {
    return Response.json(sessionData);
  }

  const { prisma } = await import("../auth/prisma");
  const accounts = await prisma.account.findMany({
    where: {
      userId: sessionData.user.id,
    },
    select: {
      providerId: true,
      password: true,
    },
  });

  const providerIds = Array.from(
    new Set(
      accounts
        .map((account: { providerId: string }) => account.providerId)
        .filter(
          (
            providerId: string,
          ): providerId is ReturnType<
            typeof listEnabledSocialProviderIds
          >[number] =>
            providerId !== "credential" &&
            listEnabledSocialProviderIds().includes(
              providerId as ReturnType<
                typeof listEnabledSocialProviderIds
              >[number],
            ),
        ),
    ),
  );

  const hasPassword = accounts.some(
    (account: { providerId: string; password: string | null }) =>
      account.providerId === "credential" && Boolean(account.password),
  );

  // Check if UserProfile exists (identity step complete)
  const userProfile = await prisma.userProfile.findUnique({
    where: { userId: sessionData.user.id },
    select: { slug: true },
  });
  const identitySet = userProfile !== null;
  const emailVerified = sessionData.user.emailVerified;
  const registrationComplete = identitySet && emailVerified;
  const canAcquireMemberToken = registrationComplete;
  const readinessStatus = registrationComplete
    ? "ready"
    : "needs-registration";

  return Response.json({
    ...sessionData,
    authSession: {
      email: sessionData.user.email,
      emailVerified,
      identitySet,
      registrationComplete,
      canAcquireMemberToken,
      readinessStatus,
      hasPassword,
      canSetPassword: !hasPassword,
      providerIds,
      primaryProviderId: providerIds[0],
      trustedProviderId: emailVerified ? providerIds[0] : undefined,
    },
  });
}

export const sessionRouter = coreInstance()
  .get(
    "/session/jwks",
    async () => {
      const { getAuthSessionJwksResponse } = await import(
        "../session/jwt/routes"
      );
      return getAuthSessionJwksResponse();
    },
    {
      detail: {
        summary: "Session JWKS public keys",
        description:
          "Canonical session-owned JSON Web Key Set (JWKS) endpoint for offline verification of auth-issued JWTs.",
        tags: ["Session"],
      },
    },
  )
  .get("/token", ({ request }) => handleAuthRequest(request), {
    detail: {
      summary: "Get auth JWT",
      description: "Get a JWT for the current authenticated browser session.",
      tags: ["Session"],
      responses: {
        200: jsonResponse("Session JWT.", authTokenResponseSchema),
      },
    },
  })
  .get("/get-session", ({ request }) => handleAuthRequest(request), {
    detail: {
      summary: "Get current session",
      description: "Retrieve the current authenticated session and user info.",
      tags: ["Session"],
      responses: {
        200: jsonResponse("Current session details.", getSessionResponseSchema),
      },
    },
  })
  .get(
    "/get-session-state",
    ({ request }) => getSessionStateResponse(request),
    {
      detail: {
        summary: "Get normalized session state",
        description:
          "Retrieve the current authenticated session together with readiness fields used by onboarding flows.",
        tags: ["Session"],
        responses: {
          200: jsonResponse(
            "Current session details with onboarding state.",
            getSessionStateResponseSchema,
          ),
        },
      },
    },
  )
  .post("/list-sessions", ({ request }) => handleAuthRequest(request), {
    detail: {
      summary: "List sessions",
      description: "List all active sessions for the current user.",
      tags: ["Session"],
      responses: {
        200: jsonResponse(
          "List of active sessions.",
          listSessionsResponseSchema,
        ),
      },
    },
  })
  .post("/revoke-session", ({ request }) => handleAuthRequest(request), {
    detail: {
      summary: "Revoke session",
      description: "Revoke a specific session by token.",
      tags: ["Session"],
      requestBody: jsonRequestBody(revokeSessionBodySchema),
    },
  });
