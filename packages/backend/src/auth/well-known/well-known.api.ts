import { Elysia } from "elysia";
import {
  handleJwksWellKnownRequest,
  handleOAuthAuthorizationServerRequest,
  handleOpenIdConfigRequest,
} from "../auth/routes";
export const wellKnownApi = new Elysia({ prefix: "/.well-known" })
  .get("/jwks.json", ({ request }) => handleJwksWellKnownRequest(request), {
    detail: {
      summary: "JWKS endpoint",
      description:
        "RFC 7517 JWKS endpoint. Returns the public signing keys used by this authorization server.",
      tags: ["Well-Known"],
    },
  })
  .get(
    "/openid-configuration",
    ({ request }) => handleOpenIdConfigRequest(request),
    {
      detail: {
        summary: "OpenID Connect discovery",
        description: "OpenID Connect discovery metadata document (RFC 8414).",
        tags: ["Well-Known"],
      },
    },
  )
  .get(
    "/oauth-authorization-server",
    ({ request }) => handleOAuthAuthorizationServerRequest(request),
    {
      detail: {
        summary: "OAuth authorization server metadata",
        description: "OAuth 2.0 Authorization Server Metadata (RFC 8414).",
        tags: ["Well-Known"],
      },
    },
  );
