import {
  accountSetupBodySchema,
  slugAvailabilityQuerySchema,
} from "@rezics/contract";
import { Elysia, status } from "elysia";
import {
  checkAccountSlugAvailability,
  completeProfileSetupFromMain,
  getMainAwareAuthSessionState,
  materializeMainAccountFromAuth,
  proxyAuthBoundaryRequest,
  refreshMainSessionFromAuth,
  renewProfileSetupSessionFromAuth,
  signOutThroughAuthBoundary,
} from "./auth-boundary.service";

export const authPublicApi = new Elysia({ prefix: "/auth" })
  .get(
    "/account/slug-availability",
    ({ query }) => checkAccountSlugAvailability(query.slug),
    {
      query: slugAvailabilityQuerySchema,
      detail: {
        summary: "Check account slug availability",
        description:
          "Main-owned slug availability check for pending account setup.",
        tags: ["Auth Boundary"],
      },
    },
  )
  .post(
    "/account/materialize",
    ({ request }) => materializeMainAccountFromAuth(request),
    {
      detail: {
        summary: "Materialize main account",
        description:
          "Create a minimal main Rezics user from verified auth registration facts and issue rezics-profile-setup-token.",
        tags: ["Auth Boundary"],
      },
    },
  )
  .post(
    "/account/profile-setup",
    ({ request, body }) => completeProfileSetupFromMain(request, body),
    {
      body: accountSetupBodySchema,
      detail: {
        summary: "Complete profile setup",
        description:
          "Activate a materialized profile-setup user as member-ready with canonical slug and optional profile fields.",
        tags: ["Auth Boundary"],
      },
    },
  )
  .post(
    "/session/refresh",
    ({ request }) => refreshMainSessionFromAuth(request),
    {
      detail: {
        summary: "Refresh main session from auth session",
        description:
          "Public main-owned auth boundary. Validates the opaque auth session through auth, verifies the main user already exists, then issues rezics-session-token.",
        tags: ["Auth Boundary"],
      },
    },
  )
  .post(
    "/account/profile-setup-token/renew",
    ({ request }) => renewProfileSetupSessionFromAuth(request),
    {
      detail: {
        summary: "Renew profile setup session",
        description:
          "Validates the opaque auth session and reissues rezics-profile-setup-token only while the main user remains profile-setup-required.",
        tags: ["Auth Boundary"],
      },
    },
  )
  .get(
    "/get-session-state",
    ({ request }) => getMainAwareAuthSessionState(request),
    {
      detail: {
        summary: "Get main-aware auth session state",
        description:
          "Returns auth session readiness augmented with whether a main Rezics user exists.",
        tags: ["Auth Boundary"],
      },
    },
  )
  // Intentionally blocks the public /auth/token endpoint: session tokens are
  // issued only by the auth service, never minted through the public boundary.
  // 有意阻断公共的 /auth/token 端点：会话令牌只由 auth 服务签发，
  // 绝不通过公共边界铸造。
  .all("/token", () => status(404, "Not Found"), {
    detail: {
      summary: "Block public auth session token acquisition",
      description:
        "Internal-only auth-owned endpoint. Main intentionally does not expose auth session JWT acquisition through the public /auth boundary.",
      tags: ["Auth Boundary"],
    },
  })
  .all("/sign-out", ({ request }) => signOutThroughAuthBoundary(request), {
    detail: {
      summary: "Sign out through auth boundary",
      description:
        "Mixed public auth boundary. Main clears rezics-session-token and proxies auth-owned session invalidation to the auth service.",
      tags: ["Auth Boundary"],
    },
  })
  .all("/*", ({ request }) => proxyAuthBoundaryRequest(request), {
    detail: {
      summary: "Proxy auth-owned public routes",
      description:
        "Public auth-owned boundary for /auth/session/jwks, /auth/oauth/*, /auth/callback/:provider, /auth/admin/*, and other auth-owned routes. Main rewrites public /auth paths to internal /api/auth paths and leaves authorization to auth.",
      tags: ["Auth Boundary"],
    },
  });
