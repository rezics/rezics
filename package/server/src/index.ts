import { cors } from "@elysiajs/cors";
import { openapi } from "@elysiajs/openapi";
import type { AuthIdentityTokenClaims } from "@rezics/contract";
import {
  NormalizedTokenName,
  TokenContextKey,
  TokenTransportHeader,
} from "@rezics/contract";
import {
  createJwtVerifier,
  createTokenResolver,
  JwtAlgorithm,
} from "@rezics/jwt";
import { Elysia } from "elysia";
import { attributionApi } from "./attribution";
import { bookApi } from "./book";
import { chapterApi } from "./chapter";
import { echoKvApi } from "./echokv";
import { env } from "./env";
import { feedbackApi } from "./feedback";
import {
  bootstrapJwtServiceRecord,
  getJwtService,
  jwtServiceAdminApi,
} from "./jwt";
import { meiliApi } from "./meili";
import { postApi } from "./post";
import { internalApi } from "./internal/internal.api";
import { reactionWriteApi } from "./reaction";
import { realmApi } from "./realm";
import { scoreApi } from "./score/score.api";
import { collectionApi, shelfApi } from "./shelf";
import { linkApi } from "./link";
import { sessionApi } from "./session";
import { statsAdminApi } from "./stats";
import { tagApi } from "./tag";
import { tokenApi } from "./token";
import { unitApi } from "./unit";
import { uploadApi } from "./upload";
import { userApi } from "./user";
import { dmServerApi } from "./notify/dm.api";
import { userBatchApi } from "./notify/user-batch.api";
import { AppError } from "./utils/errors";
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

const authBaseUrl = env.AUTH_BASE_URL;
const authAudience = env.AUTH_JWT_AUDIENCE ?? "rezics";
const authJwksUrl = new URL("/.well-known/jwks.json", authBaseUrl).toString();

await bootstrapJwtServiceRecord("auth-upstream", {
  issuer: authBaseUrl,
  audience: authAudience,
  jwksUrl: authJwksUrl,
  jwksPath: "/.well-known/jwks.json",
  isLocalIssuer: false,
});

const authUpstream = await getJwtService("auth-upstream");

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
        TokenTransportHeader.NOTIFICATION_SESSION,
        TokenTransportHeader.SEARCH_SESSION,
      ],
      maxAge: 600,
    }),
  )
  .onError(({ code, error, set }) => {
    if (error instanceof AppError) {
      set.status = error.statusCode;
    }
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
  .use(wellKnownApi)
  .use(bookApi)
  .use(chapterApi)
  .use(postApi)
  .use(shelfApi)
  .use(collectionApi)
  .use(linkApi)
  .use(realmApi)
  .use(attributionApi)
  .use(userApi)
  .use(meiliApi)
  .use(unitApi)
  .use(tagApi)
  .use(scoreApi)
  .use(internalApi)
  .use(reactionWriteApi)
  .use(tokenApi)
  .use(echoKvApi)
  .use(feedbackApi)
  .use(sessionApi)
  .use(jwtServiceAdminApi)
  .use(statsAdminApi)
  .use(uploadApi)
  .use(dmServerApi)
  .use(userBatchApi)
  .get("/", () => "Hello Elysia")
  .get("/health", () => ({ status: "ok" }));

app.listen(port);

console.log(
  `🦊 Elysia is running at http://${app.server?.hostname}:${app.server?.port}`,
  `\n🔗 Openapi UI: http://${app.server?.hostname}:${app.server?.port}/openapi`,
);
