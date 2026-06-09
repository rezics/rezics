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
import { activityApi } from "./activity";
import { accountOperationsAdminApi } from "./admin-account";
import { adminRepairJobApi } from "./admin-repair-job";
import { authPublicApi } from "./auth-boundary";
import { blockApi } from "./block";
import { bookApi } from "./book";
import { chapterApi } from "./chapter";
import { commentApi } from "./comment";
import { contentStructureApi } from "./content-structure";
import { contentTranslationApi } from "./content-translation";
import { creditAttributionApi } from "./credit-attribution";
import { dashboardApi } from "./dashboard";
import { statusApi } from "./diagnostic";
import { dispatchApi } from "./dispatch";
import { draftApi } from "./draft";
import { echoKvApi } from "./echokv";
import { entityApi } from "./entity";
import { entityAttributionApi } from "./entity-attribution";
import { env } from "./env";
import { feedApi } from "./feed";
import { feedbackApi } from "./feedback";
import { gameSystemRequirementApi } from "./game-system-requirement";
import { governanceApi } from "./governance";
import { historyProxyApi, historyResolutionApi } from "./history";
import { initDefaultRealmCache } from "./infra/default-realm";
import { infraApi } from "./infra/infra.api";
import { initSeedTagsCache } from "./infra/seed-tags";
import { initSlugScopesCache } from "./infra/slug-scopes";
import { bootstrapJwtServiceRecord, jwtServiceAdminApi } from "./jwt";
import { labelApi } from "./label";
import { linkApi } from "./link";
import { federatedSearchApi, meiliApi } from "./meili";
import { dmBoundaryApi } from "./notify-boundary/dm-boundary.api";
import { pollApi } from "./poll";
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
import { seriesApi } from "./series-unit";
import { collectionApi, shelfApi } from "./shelf";
import { slugApi } from "./slug";
import { sourceSiteApi } from "./source-site";
import { statsAdminApi } from "./stat";
import { subjectAttributionApi } from "./subject-attribution";
import { subscriptionApi } from "./subscription";
import { lowScoreTagsAdminApi, tagApi, tagVoteApi, unitTagApi } from "./tag";
import { tokenApi } from "./token";
import {
  historyOutboxAdminApi,
  translationSourceApi,
  unitApi,
  unitAuthorityApi,
} from "./unit";
import { unitAliasApi, unitAliasVoteApi } from "./unit-alias-record";
import { unitExternalRefApi } from "./unit-external-ref";
import { uploadApi } from "./upload";
import { userApi, userBriefApi } from "./user";
import { userTagApplicationApi } from "./user-tag-application";
import { userUnitCollectionApi } from "./user-unit-collection";
import { readDatabaseErrorDetails } from "./utils/database-error";
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
    readyPath: "/ready",
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
// 引导用于签发 rezics-session-tokens 的服务器本地 JWT 服务
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
      // x-auth-session-token is intentionally absent: session credentials travel only via the httpOnly cookie, never a request header.
      // x-auth-session-token 有意缺席：会话凭证仅通过 httpOnly cookie 传递，绝不经由请求头。
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
    }

    const database = readDatabaseErrorDetails(error);
    if (database) {
      const databaseStatusMap: Record<string, number> = {
        "23505": 409,
        "23503": 400,
        "23502": 400,
        "23514": 400,
        "22P02": 400,
      };
      const status = databaseStatusMap[database.code];
      if (status) {
        set.status = status;

        const humanMessages: Record<string, string> = {
          "23505": "Record already exists",
          "23503": "Related record not found",
          "23502": "Required field is missing",
          "23514": "Database constraint violation",
          "22P02": "Invalid database input",
        };

        return {
          status: set.status,
          code,
          message: humanMessages[database.code] ?? "Database error",
          detail: {
            database,
          },
        };
      }
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
  .use(commentApi)
  .use(contentTranslationApi)
  .use(contentStructureApi)
  .use(chapterApi)
  .use(pollApi)
  .use(postApi)
  .use(feedApi)
  .use(progressApi)
  .use(dashboardApi)
  .use(draftApi)
  .use(activityApi)
  .use(shelfApi)
  .use(collectionApi)
  .use(linkApi)
  .use(zoneApi)
  .use(labelApi)
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
  .use(gameSystemRequirementApi)
  .use(entityApi)
  .use(slugApi)
  .use(subscriptionApi)
  .use(userApi)
  .use(userBriefApi)
  .use(userUnitCollectionApi)
  .use(userTagApplicationApi)
  .use(meiliApi)
  .use(federatedSearchApi)
  .use(unitApi)
  .use(unitAliasApi)
  .use(unitAliasVoteApi)
  .use(unitAuthorityApi)
  .use(historyOutboxAdminApi)
  .use(translationSourceApi)
  .use(infraApi)
  .use(tagApi)
  .use(unitTagApi)
  .use(tagVoteApi)
  .use(lowScoreTagsAdminApi)
  .use(scoreApi)
  .use(seriesApi)
  .use(reactionBoundaryApi)
  .use(profileReactionHistoryApi)
  .use(dispatchApi)
  .use(tokenApi)
  .use(echoKvApi)
  .use(feedbackApi)
  .use(blockApi)
  .use(governanceApi)
  .use(historyProxyApi)
  .use(historyResolutionApi)
  .use(jwtServiceAdminApi)
  .use(statusApi)
  .use(statsAdminApi)
  .use(accountOperationsAdminApi)
  .use(adminRepairJobApi)
  .use(uploadApi)
  .use(dmBoundaryApi)
  .get("/", () => "Hello Elysia")
  .get("/health", () => ({ status: "ok" }))
  .get("/ready", () => ({ status: "ready" }));

// Slug-scopes must hydrate first: default-realm and seed-tags lookups go
// through `(slugScope, slug)` and depend on the scope cache being populated.
// slug-scopes 必须先完成填充：default-realm 和 seed-tags 查询都经由
// `(slugScope, slug)`，依赖 scope 缓存已被填充。
await initSlugScopesCache();
await Promise.all([initDefaultRealmCache(), initSeedTagsCache()]);

app.listen(port);
logStartupBanner(observability);
