import { cors } from "@elysiajs/cors";
import { openapi } from "@elysiajs/openapi";
import { Elysia } from "elysia";
import { Prisma } from "#/prisma/client";
import { attributionApi } from "./attribution";
import { bookApi } from "./book";
import { chapterApi } from "./chapter";
import { dispatchApi } from "./dispatch";
import { echoKvApi } from "./echokv";
import { env } from "./env";
import { feedbackApi } from "./feedback";
import { initDefaultRealmCache } from "./infra/default-realm";
import { infraApi } from "./infra/infra.api";
import { initSeedTagsCache } from "./infra/seed-tags";
import { internalApi } from "./internal/internal.api";
import { bootstrapJwtServiceRecord, jwtServiceAdminApi } from "./jwt";
import { linkApi } from "./link";
import { meiliApi } from "./meili";
import { dmServerApi } from "./notify/dm.api";
import { userBatchApi } from "./notify/user-batch.api";
import { pinboardApi } from "./pinboard";
import { postApi } from "./post";
import { reactionWriteApi } from "./reaction";
import { realmApi } from "./realm";
import { scoreApi } from "./score/score.api";
import { sessionApi } from "./session";
import { collectionApi, shelfApi } from "./shelf";
import { statsAdminApi } from "./stat";
import { tagApi } from "./tag";
import { tokenApi } from "./token";
import { translationGroupApi } from "./translation-group";
import { unitApi } from "./unit";
import { uploadApi } from "./upload";
import { userApi, userBriefApi } from "./user";
import { AppError } from "./utils/errors";
import { getProdState } from "./utils/getProdState";
import { wellKnownApi } from "./well-known/well-known.api";
import { zoneApi } from "./zone/zone.api";
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

// Bootstrap server-local JWT service for signing rezics-session-tokens
const serverJwksUrl = `http://localhost:${port}/.well-known/jwks.json`;

await bootstrapJwtServiceRecord("server-local", {
  issuer: "rezics-server",
  audience: "rezics",
  jwksUrl: serverJwksUrl,
  jwksPath: "/.well-known/jwks.json",
  isLocalIssuer: true,
});

// Bootstrap auth-upstream JWT service for token exchange verification
await bootstrapJwtServiceRecord("auth-upstream", {
  issuer: authBaseUrl,
  audience: authAudience,
  jwksUrl: authJwksUrl,
  jwksPath: "/.well-known/jwks.json",
  isLocalIssuer: false,
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
        "x-auth-session-token",
        "x-internal-secret",
      ],
      maxAge: 600,
    }),
  )
  .onError(({ code, error, set }) => {
    if (error instanceof AppError) {
      set.status = error.statusCode;
    } else if (error instanceof Prisma.PrismaClientKnownRequestError) {
      const prismaStatusMap: Record<string, number> = {
        P2025: 404,
        P2002: 409,
        P2003: 400,
        P2014: 400,
      };
      set.status = prismaStatusMap[error.code] ?? 500;

      const modelName =
        (error.meta?.["modelName"] as string | undefined) ??
        (error.meta?.["model"] as string | undefined);
      const target = error.meta?.["target"] as string[] | undefined;

      const humanMessages: Record<string, string> = {
        P2025: `${modelName ?? "Record"} not found`,
        P2002: `${modelName ?? "Record"} already exists`,
        P2003: `Related ${modelName ?? "record"} not found`,
        P2014: `Required relation on ${modelName ?? "record"} is missing`,
      };

      return {
        status: set.status,
        code,
        message: humanMessages[error.code] ?? "Database error",
        detail: {
          prisma: {
            code: error.code,
            ...(modelName && { model: modelName }),
            ...(target && { target }),
          },
        },
      };
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
  .use(wellKnownApi)
  .use(bookApi)
  .use(chapterApi)
  .use(postApi)
  .use(shelfApi)
  .use(collectionApi)
  .use(linkApi)
  .use(zoneApi)
  .use(realmApi)
  .use(pinboardApi)
  .use(attributionApi)
  .use(userApi)
  .use(userBriefApi)
  .use(meiliApi)
  .use(unitApi)
  .use(infraApi)
  .use(tagApi)
  .use(translationGroupApi)
  .use(scoreApi)
  .use(internalApi)
  .use(reactionWriteApi)
  .use(dispatchApi)
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

await Promise.all([initDefaultRealmCache(), initSeedTagsCache()]);

app.listen(port);

console.log(
  `🦊 Elysia is running at http://${app.server?.hostname}:${app.server?.port}`,
  `\n🔗 Openapi UI: http://${app.server?.hostname}:${app.server?.port}/openapi`,
);
