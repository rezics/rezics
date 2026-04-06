import { cors } from "@elysiajs/cors";
import { openapi } from "@elysiajs/openapi";
import type {
  AuthIdentityTokenClaims,
  RezicsSessionTokenClaims,
} from "@rezics/contract";
import {
  NormalizedTokenName,
  TokenContextKey,
  // TokenTransportHeader,
  // TokenTransportHeader,
} from "@rezics/contract";
import {
  createJwtVerifier,
  createTokenResolver,
  JwtAlgorithm,
} from "@rezics/jwt";
import { Elysia } from "elysia";
import { bookApi } from "./book";
import { chapterApi } from "./chapter";
import { commentApi } from "./comment";
import { echoKvApi } from "./echokv";
import { env } from "./env";
import { feedbackApi } from "./feedback";
import {
  bootstrapJwtServiceRecord,
  getJwtService,
  jwtServiceAdminApi,
} from "./jwt";
import { meiliApi } from "./meili";
import { reactionApi } from "./reaction";
import { readlistApi } from "./readlist";
import { reviewApi } from "./review";
import { sessionApi } from "./session";
import { serverSessionJwksPath } from "./session/jwt/jwt-metadata";
import { statsAdminApi } from "./stats";
import { tagApi } from "./tag";
import { tokenApi } from "./token";
import { unitApi } from "./unit";
import { uploadApi } from "./upload";
import { userApi } from "./user";
import { getProdState } from "./utils/getProdState";
import { wellKnownApi } from "./well-known/well-known.api";

import "dotenv/config";

const { isProd, isDev } = getProdState();

const app = new Elysia();

if (isDev) {
  await import("./utils/logger-hook");
  app
    .use(openapi({ exclude: { staticFile: false } }))
    .trace(async ({ onHandle, context }) => {
      onHandle(({ begin, onStop }) => {
        const { route, params, request } = context;

        onStop(({ end }) => {
          console.log(
            `[${request.method}] ${route} took ${end - begin}ms`,
            "params:",
            params,
          );
        });
      });
    });
}

const port = env.PORT ? Number(env.PORT) : 3000;

const serverBaseUrl = env.MAIN_SESSION_JWT_ISSUER ?? `http://localhost:${port}`;
const authBaseUrl = env.AUTH_BASE_URL;
const authAudience = env.AUTH_JWT_AUDIENCE ?? "rezics";
const authJwksUrl = new URL("/.well-known/jwks.json", authBaseUrl).toString();

await Promise.all([
  bootstrapJwtServiceRecord("server-local", {
    issuer: serverBaseUrl,
    audience: env.MAIN_SESSION_JWT_AUDIENCE ?? "rezics",
    jwksUrl: new URL(serverSessionJwksPath, serverBaseUrl).toString(),
    jwksPath: serverSessionJwksPath,
    isLocalIssuer: true,
  }),
  bootstrapJwtServiceRecord("auth-upstream", {
    issuer: authBaseUrl,
    audience: authAudience,
    jwksUrl: authJwksUrl,
    jwksPath: "/.well-known/jwks.json",
    isLocalIssuer: false,
  }),
]);

const authUpstream = await getJwtService("auth-upstream");
const serverLocal = await getJwtService("server-local");

const authIdentityVerifier = createJwtVerifier<AuthIdentityTokenClaims>({
  issuer: authUpstream.issuer,
  audience: authUpstream.audience,
  jwksUrl: authUpstream.jwksUrl,
  algorithm: JwtAlgorithm.ES256,
  tokenName: NormalizedTokenName.AUTH_IDENTITY,
  clockToleranceSeconds: Number(env.AUTH_JWT_CLOCK_TOLERANCE_SECONDS ?? "5"),
  requiredScope: "user",
  enforceTransport: true,
});

const rezicsSessionVerifier = createJwtVerifier<RezicsSessionTokenClaims>({
  issuer: serverLocal.issuer,
  audience: serverLocal.audience,
  jwksUrl: serverLocal.jwksUrl,
  algorithm: JwtAlgorithm.ES256,
  tokenName: NormalizedTokenName.REZICS_SESSION,
  clockToleranceSeconds: 5,
  enforceTransport: true,
});

const devOrigins = [
  "http://localhost:35001",
  "http://localhost:35002",
  "http://localhost:8000",
];

const prodOrigins = ["https://book.rezics.com", "https://rezics.com"];

app
  .use(
    cors({
      origin: isDev ? devOrigins : prodOrigins,
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: [
        "content-type",
        "authorization",
        "accept",
        TokenTransportHeader.AUTH_CONTEXT,
        TokenTransportHeader.REZICS_SESSION,
        TokenTransportHeader.NOTIFICATION_SESSION,
        TokenTransportHeader.SEARCH_SESSION,
      ],
      exposeHeaders: [TokenTransportHeader.REZICS_SESSION],
      maxAge: 600,
    }),
  )
  .onError(({ code, error, set }) => {
    set.status ||= 500;
    const message =
      error instanceof Error ? error.message : "Internal Server Error";

    return {
      status: set.status,
      code,
      message,
    };
  })
  .use(
    createTokenResolver<
      typeof TokenContextKey.AUTH_IDENTITY,
      AuthIdentityTokenClaims
    >(TokenContextKey.AUTH_IDENTITY, {
      headerName: TokenTransportHeader.AUTHORIZATION,
      usesBearer: true,
      verifier: authIdentityVerifier,
    }),
  )
  .use(
    createTokenResolver<
      typeof TokenContextKey.REZICS_SESSION,
      RezicsSessionTokenClaims
    >(TokenContextKey.REZICS_SESSION, {
      headerName: TokenTransportHeader.REZICS_SESSION,
      usesBearer: false,
      verifier: rezicsSessionVerifier,
    }),
  )
  .use(wellKnownApi)
  .use(bookApi)
  .use(chapterApi)
  .use(readlistApi)
  .use(reviewApi)
  .use(userApi)
  .use(meiliApi)
  .use(unitApi)
  .use(tagApi)
  .use(commentApi)
  .use(reactionApi)
  .use(tokenApi)
  .use(echoKvApi)
  .use(feedbackApi)
  .use(sessionApi)
  .use(jwtServiceAdminApi)
  .use(statsAdminApi)
  .use(uploadApi)
  .get("/", () => "Hello Elysia")
  .get("/health", () => ({ status: "ok" }));

app.listen(port);

console.log(
  `🦊 Elysia is running at http://${app.server?.hostname}:${app.server?.port}`,
  `\n🔗 Openapi UI: http://${app.server?.hostname}:${app.server?.port}/openapi`,
);
