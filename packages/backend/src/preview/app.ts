import { html } from "@elysiajs/html";
import { openapi } from "@elysiajs/openapi";
import {
  elysiaObservability,
  type ObservabilityConfig,
} from "@rezics/shared/observability";
import { Elysia } from "elysia";
import { sitemapApi } from "./sitemap/sitemap.api";

type BookRoutes = typeof import("./book/book.api").bookApi;

export type CreatePreviewAppOptions = {
  isDev?: boolean;
  bookRoutes?: BookRoutes | false;
  observability?: ObservabilityConfig;
};

export function createPreviewApp(options: CreatePreviewAppOptions = {}) {
  const app = new Elysia();

  if (options.observability) {
    app.use(elysiaObservability(options.observability));
  }

  app.use(html()).use(sitemapApi);

  if (options.bookRoutes) {
    app.use(options.bookRoutes);
  }

  app.get("/health", () => ({
    status: "ok",
  }));

  if (options.isDev) {
    app.use(openapi({ exclude: { staticFile: false } }));
  }

  return app;
}

export type PreviewApp = ReturnType<typeof createPreviewApp>;
