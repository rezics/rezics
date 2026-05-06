import { Elysia, status } from "elysia";
import {
  proxyAuthBoundaryRequest,
  refreshMainSessionFromAuth,
  signOutThroughAuthBoundary,
} from "./auth-boundary.service";

export const authPublicApi = new Elysia({ prefix: "/auth" })
  .post(
    "/session/refresh",
    ({ request }) => refreshMainSessionFromAuth(request),
    {
      detail: {
        summary: "Refresh main session from auth session",
        description:
          "Public main-owned auth boundary. Validates the opaque auth session through auth, verifies or provisions the main user, then issues rezics-session-token.",
        tags: ["Auth Boundary"],
      },
    },
  )
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
        "Public auth-owned boundary for /auth/session/jwks, /auth/oauth/*, /auth/callback/:provider, /auth/admin/*, /auth/organization/*, and other auth-owned routes. Main rewrites public /auth paths to internal /api/auth paths and leaves authorization to auth.",
      tags: ["Auth Boundary"],
    },
  });
