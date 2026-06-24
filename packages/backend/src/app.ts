import type { ObservabilityConfig } from "@rezics/shared/observability";
import { resolveBackendPort } from "./env";
import { createPreviewApp } from "./preview/app";
import { bookApi as previewBookRoutes } from "./preview/book/book.api";

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
  serviceKey?: string;
};

type ServiceAppResult = {
  app: FetchableApp;
};

type ServerAppResult = {
  app: MountableApp;
  observability: ObservabilityConfig;
  port: number;
};
type ServerAppFactory = (
  options?: ServerAppOptions,
) => Promise<ServerAppResult>;
type ServiceAppFactory = (
  options?: ServiceAppOptions,
) => Promise<ServiceAppResult>;

const appFactories = {
  auth: ["@rezics/auth/app", "createAuthApp"],
  history: ["@rezics/history/app", "createHistoryApp"],
  notify: ["@rezics/notify/app", "createNotifyApp"],
  ranking: ["@rezics/ranking/app", "createRankingApp"],
  reaction: ["@rezics/reaction/app", "createReactionApp"],
  server: ["@rezics/server/app", "createServerApp"],
} as const satisfies Record<
  Exclude<BackendMountedService, "preview">,
  readonly [string, string]
>;

async function loadExport<Export>(
  specifier: string,
  exportName: string,
): Promise<Export> {
  const loaded = (await import(specifier)) as Record<string, unknown>;
  if (!(exportName in loaded)) {
    throw new Error(`Module ${specifier} does not export ${exportName}`);
  }

  return loaded[exportName] as Export;
}

async function loadFactory<Factory>(
  specifier: string,
  exportName: string,
): Promise<Factory> {
  const factory = await loadExport<unknown>(specifier, exportName);
  if (typeof factory !== "function") {
    throw new Error(`Module ${specifier} does not export ${exportName}`);
  }

  return factory as Factory;
}

async function loadServerAppFactory(): Promise<ServerAppFactory> {
  const [specifier, exportName] = appFactories.server;
  return loadFactory<ServerAppFactory>(specifier, exportName);
}

async function loadServiceAppFactory(
  service: Exclude<BackendMountedService, "preview" | "server">,
): Promise<ServiceAppFactory> {
  const [specifier, exportName] = appFactories[service];
  return loadFactory<ServiceAppFactory>(specifier, exportName);
}

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
  const createServerApp = await loadServerAppFactory();
  const server = await createServerApp({
    displayName: "Backend Monolith",
    initializeTelemetry: true,
    openApiPath: "/openapi",
    port,
  });
  const app = server.app;

  const [
    createAuthApp,
    createNotifyApp,
    createReactionApp,
    createHistoryApp,
    createRankingApp,
  ] = await Promise.all([
    loadServiceAppFactory("auth"),
    loadServiceAppFactory("notify"),
    loadServiceAppFactory("reaction"),
    loadServiceAppFactory("history"),
    loadServiceAppFactory("ranking"),
  ]);

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
