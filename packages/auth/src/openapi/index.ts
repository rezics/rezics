import { Elysia } from "elysia";
import { handleAuthRequest } from "../auth/routes";
import { env } from "../env";
import { jwtServiceAdminRouter } from "../jwt/jwt.admin.api";
import { adminRouter } from "./admin";
import { oauthRouter } from "./oauth";
import { passwordRouter } from "./password";
import { selfServiceRouter } from "./self-service";
import { sessionRouter } from "./session";
import { signInRouter } from "./sign-in";

export const authOpenApiRouter = new Elysia({
  prefix: env.AUTH_OPENAPI_ROUTER_PREFIX,
})
  .use(signInRouter)
  .use(passwordRouter)
  .use(sessionRouter)
  .use(adminRouter)
  .use(oauthRouter)
  .use(selfServiceRouter)
  .use(jwtServiceAdminRouter)
  .use(
    new Elysia().all("/*", ({ request }) => handleAuthRequest(request), {
      detail: {
        summary: "Catch All",
        description: "Catch all route for all requests.",
        tags: ["Catch All"],
      },
    }),
  );
