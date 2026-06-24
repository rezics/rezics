import type {
  ObservabilityConfig,
  ServiceKey,
} from "@rezics/shared/observability";
import { createAuthApp } from "./auth/app";
import { resolveBackendPort } from "./env";
import { createHistoryApp } from "./history/app";
import { createNotifyApp } from "./notify/app";
import { createPreviewApp } from "./preview/app";
import { bookApi as previewBookRoutes } from "./preview/book/book.api";
import { createRankingApp } from "./ranking/app";
import { createReactionApp } from "./reaction/app";
import { createServerApp } from "../../server/src/app";

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

type FetchableApp = {
  fetch(request: Request): Response | Promise<Response>;
};

type MountableApp = FetchableApp & {
  get(path: string, handler: () => unknown): unknown;
  listen(port: number): unknown;
  mount(
    path: string,
    handler: (request: Request) => Response | Promise<Response>,
  ): unknown;
};

type ServiceAppOptions = {
  initializeTelemetry?: boolean;
  openApiPath?: string | false;
  port?: number;
};

type ServerAppOptions = ServiceAppOptions & {
  displayName?: string;
  serviceKey?: ServiceKey;
};

type ServerAppResult = {
  app: MountableApp;
  observability: ObservabilityConfig;
  port: number;
};

type CreateServerApp = (options?: ServerAppOptions) => Promise<ServerAppResult>;

const createMonolithServerApp: CreateServerApp = createServerApp;

function mountService(
  root: MountableApp,
  prefix: string,
  service: FetchableApp,
) {
  root.mount(prefix, (request) => service.fetch(request));
}

export async function createBackendApp(options: CreateBackendAppOptions = {}) {
  const port = options.port ?? resolveBackendPort();
  const internalPrefix =
    options.internalServicePrefix ?? INTERNAL_SERVICE_PREFIX;
  const server = await createMonolithServerApp({
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

  mountService(app, `${internalPrefix}/auth`, auth.app);
  mountService(app, `${internalPrefix}/notify`, notify.app);
  mountService(app, `${internalPrefix}/reaction`, reaction.app);
  mountService(app, `${internalPrefix}/history`, history.app);
  mountService(app, `${internalPrefix}/ranking`, ranking.app);
  mountService(app, `${internalPrefix}/preview`, preview);

  app.get(`${internalPrefix}/health`, () => ({
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
