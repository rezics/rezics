import { createAuthApp } from "./auth/app";
import { resolveBackendPort } from "./env";
import { createHistoryApp } from "./history/app";
import { createNotifyApp } from "./notify/app";
import { createPreviewApp } from "./preview/app";
import { bookApi as previewBookRoutes } from "./preview/book/book.api";
import { createRankingApp } from "./ranking/app";
import { createReactionApp } from "./reaction/app";
import { createServerApp } from "./server/app";

export const INTERNAL_SERVICE_PREFIX = "/__services";

export type BackendMountedService =
  | "auth"
  | "history"
  | "notify"
  | "preview"
  | "ranking"
  | "reaction"
  | "server";

export type CreateBackendAppOptions = {
  internalServicePrefix?: string;
  port?: number;
};

export async function createBackendApp(options: CreateBackendAppOptions = {}) {
  const port = options.port ?? resolveBackendPort();
  const internalPrefix =
    options.internalServicePrefix ?? INTERNAL_SERVICE_PREFIX;
  const server = await createServerApp({
    displayName: "Backend Monolith",
    initializeTelemetry: true,
    openApiPath: "/openapi",
    port,
  });
  const app = server.app;

  const [auth, notify, reaction, history, ranking] = await Promise.all([
    createAuthApp({
      initializeTelemetry: false,
      openApiPath: false,
      port,
    }),
    createNotifyApp({
      initializeTelemetry: false,
      openApiPath: false,
      port,
    }),
    createReactionApp({
      initializeTelemetry: false,
      openApiPath: false,
      port,
    }),
    createHistoryApp({
      initializeTelemetry: false,
      openApiPath: false,
      port,
    }),
    createRankingApp({
      initializeTelemetry: false,
      openApiPath: false,
      port,
    }),
  ]);
  const preview = createPreviewApp({
    bookRoutes: previewBookRoutes,
    isDev: process.env.NODE_ENV !== "production",
  });

  app
    .group(`${internalPrefix}/auth`, (group) => group.use(auth.app))
    .group(`${internalPrefix}/notify`, (group) => group.use(notify.app))
    .group(`${internalPrefix}/reaction`, (group) => group.use(reaction.app))
    .group(`${internalPrefix}/history`, (group) => group.use(history.app))
    .group(`${internalPrefix}/ranking`, (group) => group.use(ranking.app))
    .group(`${internalPrefix}/preview`, (group) => group.use(preview))
    .get(`${internalPrefix}/health`, () => ({
      status: "ok",
      services: [
        "server",
        "auth",
        "notify",
        "reaction",
        "history",
        "ranking",
        "preview",
      ] satisfies BackendMountedService[],
    }));

  return {
    app,
    internalPrefix,
    observability: server.observability,
    port,
  };
}

export type BackendApp = Awaited<ReturnType<typeof createBackendApp>>["app"];