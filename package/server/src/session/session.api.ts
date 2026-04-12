import { Elysia } from "elysia";
import { getMainSessionPublicJwks } from "./jwt/jwt.service.ts";

export const sessionApi = new Elysia({ prefix: "/session" }).get(
  "/jwks",
  async () => getMainSessionPublicJwks(),
  {
    detail: {
      summary: "Publish main-server JWKS (legacy)",
      description:
        "Legacy JWKS endpoint. Use `/.well-known/jwks.json` instead. Returns the same public signing keys used by this resource server for session tokens.",
      tags: ["Session"],
      deprecated: true,
    },
  },
);
