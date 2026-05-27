import { cors } from "@elysiajs/cors";
import { openapi } from "@elysiajs/openapi";
import {
  createObservabilityConfig,
  createTelemetryConfig,
  elysiaObservability,
  initializeOpenTelemetry,
  logStartupBanner,
} from "@rezics/shared/observability";
import { Elysia } from "elysia";
import { Prisma } from "#/prisma/client";
import { adminWorkMergeApi } from "./admin-work-merge";
import { authPublicApi } from "./auth-boundary";
import { bookApi } from "./book";
import { chapterApi } from "./chapter";
import { contentStructureApi } from "./content-structure";
import { creditAttributionApi } from "./credit-attribution";
import { statusApi } from "./diagnostic";
import { dispatchApi } from "./dispatch";
import { echoKvApi } from "./echokv";
import { entityApi } from "./entity";
import { entityAttributionApi } from "./entity-attribution";
import { env } from "./env";
import { feedbackApi } from "./feedback";
import { historyProxyApi, historyResolutionApi } from "./history";
import { initDefaultRealmCache } from "./infra/default-realm";
import { infraApi } from "./infra/infra.api";
import { initSeedTagsCache } from "./infra/seed-tags";
import { initSlugScopesCache } from "./infra/slug-scopes";
import { bootstrapJwtServiceRecord, jwtServiceAdminApi } from "./jwt";
import { linkApi } from "./link";
import { federatedSearchApi, meiliApi } from "./meili";
import { dmBoundaryApi } from "./notify-boundary/dm-boundary.api";
import { postApi } from "./post";
import { profileReactionHistoryApi } from "./profile-reaction-history";
import { progressApi } from "./progress";
import { reactionBoundaryApi } from "./reaction-boundary";
import {
  realmApi,
  realmExtraApi,
  realmTagApplicationApi,
  realmTagApplicationVoteApi,
  realmTagContextApi,
} from "./realm";
import { scoreApi } from "./score/score.api";
import { collectionApi, shelfApi } from "./shelf";
import { slugApi } from "./slug";
import { sourceSiteApi } from "./source-site";
import { statsAdminApi } from "./stat";
import { subjectAttributionApi } from "./subject-attribution";
import { subscriptionApi } from "./subscription";
import { lowScoreTagsAdminApi, tagApi, tagVoteApi, unitTagApi } from "./tag";
import { tokenApi } from "./token";
import { translationGroupApi } from "./translation-group";
import {
  historyOutboxAdminApi,
  translationSourceApi,
  unitApi,
  unitAuthorityApi,
  unitWorkMembershipApi,
  workMembershipClaimApi,
} from "./unit";
import { unitWorkApi } from "./unit-work";
import { unitAliasApi, unitAliasVoteApi } from "./unit-alias-record";
import { unitExternalRefApi } from "./unit-external-ref";
import { uploadApi } from "./upload";
import { userApi, userBriefApi } from "./user";
import { AppError } from "./utils/errors";
import { getProdState } from "./utils/getProdState";
import { wellKnownApi } from "./well-known/well-known.api";
import { zoneApi } from "./zone/zone.api";
import "dotenv/config";

const { isDev } = getProdState();

const app = new Elysia();
const port = env.PORT ? Number(env.PORT) : 3000;
const observability = createObservabilityConfig(
  {
    key: "server",
    displayName: "Main Server",
    environment: env.NODE_ENV ?? "development",
    port,
    openApiPath: isDev ? "/openapi" : undefined,
    healthPath: "/health",
  },
  {
    nodeEnv: env.NODE_ENV,
    logFormat: env.OBSERVABILITY_LOG_FORMAT,
    color: env.OBSERVABILITY_COLOR,
    slowRequestThresholdMs: env.OBSERVABILITY_SLOW_REQUEST_MS,
    telemetryMode: env.OBSERVABILITY_TELEMETRY,
    otlpEndpoint: env.OTEL_EXPORTER_OTLP_ENDPOINT,
  },
);

await initializeOpenTelemetry(
  createTelemetryConfig(observability.service, {
    nodeEnv: env.NODE_ENV,
    telemetryMode: env.OBSERVABILITY_TELEMETRY,
    otlpEndpoint: env.OTEL_EXPORTER_OTLP_ENDPOINT,
  }),
);

app.use(elysiaObservability(observability));

if (isDev) {
  app.use(openapi({ exclude: { staticFile: false } }));
}

// Bootstrap server-local JWT service for signing rezics-session-tokens
const serverJwksUrl = `http://localhost:${port}/.well-known/jwks.json`;

await bootstrapJwtServiceRecord("server-local", {
  issuer: "rezics-server",
  audience: "rezics",
  jwksUrl: serverJwksUrl,
  jwksPath: "/.well-known/jwks.json",
  isLocalIssuer: true,
});

const devOrigins = [
  "http://localhost:35001",
  "http://localhost:35002",
  "http://localhost:8000",
];

const prodOrigins = ["https://book.rezics.com", "https://rezics.com"];

const configuredApp = app
  .use(
    cors({
      origin: isDev ? devOrigins : prodOrigins,
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["content-type", "authorization", "accept"],
      maxAge: 600,
    }),
  )
  .onError(({ code, error, set }) => {
    if (error instanceof AppError) {
      set.status = error.statusCode;
      return {
        status: error.statusCode,
        code: error.code ?? code,
        message: error.message,
        ...(error.details ? { detail: error.details } : {}),
      };
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
  });

const routeApp = configuredApp as any;

routeApp
  .use(authPublicApi)
  .use(wellKnownApi)
  .use(bookApi)
  .use(contentStructureApi)
  .use(chapterApi)
  .use(postApi)
  .use(progressApi)
  .use(shelfApi)
  .use(collectionApi)
  .use(linkApi)
  .use(zoneApi)
  .use(realmApi)
  .use(realmExtraApi)
  .use(realmTagContextApi)
  .use(realmTagApplicationApi)
  .use(realmTagApplicationVoteApi)
  .use(creditAttributionApi)
  .use(subjectAttributionApi)
  .use(entityAttributionApi)
  .use(sourceSiteApi)
  .use(unitExternalRefApi)
  .use(entityApi)
  .use(slugApi)
  .use(subscriptionApi)
  .use(userApi)
  .use(userBriefApi)
  .use(meiliApi)
  .use(federatedSearchApi)
  .use(unitApi)
  .use(unitWorkApi)
  .use(unitAliasApi)
  .use(unitAliasVoteApi)
  .use(unitAuthorityApi)
  .use(historyOutboxAdminApi)
  .use(unitWorkMembershipApi)
  .use(workMembershipClaimApi)
  .use(translationSourceApi)
  .use(infraApi)
  .use(tagApi)
  .use(unitTagApi)
  .use(tagVoteApi)
  .use(lowScoreTagsAdminApi)
  .use(translationGroupApi)
  .use(scoreApi)
  .use(reactionBoundaryApi)
  .use(profileReactionHistoryApi)
  .use(dispatchApi)
  .use(tokenApi)
  .use(echoKvApi)
  .use(feedbackApi)
  .use(historyProxyApi)
  .use(historyResolutionApi)
  .use(jwtServiceAdminApi)
  .use(statusApi)
  .use(statsAdminApi)
  .use(adminWorkMergeApi)
  .use(uploadApi)
  .use(dmBoundaryApi)
  .get("/", () => "Hello Elysia")
  .get("/health", () => ({ status: "ok" }));

// Slug-scopes must hydrate first: default-realm and seed-tags lookups go
// through `(slugScope, slug)` and depend on the scope cache being populated.
await initSlugScopesCache();
await Promise.all([initDefaultRealmCache(), initSeedTagsCache()]);

app.listen(port);
logStartupBanner(observability);
