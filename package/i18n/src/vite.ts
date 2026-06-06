/**
 * Vite plugin that exposes the shared `package/i18n/locales/` tree at
 * `/locales/*` for dev server and copies the tree into `dist/locales/` for
 * production builds. Consumers add it to their `vite.config.ts` plugins
 * array; no other configuration is needed.
 */

import { readdir, readFile, stat } from "node:fs/promises";
import { extname, join, normalize, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import type { Plugin } from "vite";

const LOCALES_DIR = fileURLToPath(new URL("../locales/", import.meta.url));

async function* walk(root: string): AsyncGenerator<string> {
  for (const name of await readdir(root)) {
    const full = join(root, name);
    const st = await stat(full);
    if (st.isDirectory()) yield* walk(full);
    else yield full;
  }
}

function mimeFor(file: string): string {
  switch (extname(file)) {
    case ".json":
      return "application/json; charset=utf-8";
    default:
      return "application/octet-stream";
  }
}

export function rezicsI18nLocales(): Plugin {
  const localesRoot = resolve(LOCALES_DIR);
  return {
    name: "rezics-i18n-locales",
    configureServer(server) {
      server.middlewares.use("/locales", async (req, res, next) => {
        const urlPath = (req.url ?? "").split("?")[0];
        if (!urlPath) return next();
        const target = normalize(join(localesRoot, urlPath));
        // Containment check against directory traversal.
        const rel = relative(localesRoot, target);
        if (rel.startsWith("..") || rel.includes(`..${sep}`)) {
          res.statusCode = 403;
          res.end("forbidden");
          return;
        }
        try {
          const data = await readFile(target);
          res.setHeader("Content-Type", mimeFor(target));
          res.setHeader("Cache-Control", "no-store");
          res.statusCode = 200;
          res.end(data);
        } catch {
          next();
        }
      });
    },
    async generateBundle() {
      for await (const file of walk(localesRoot)) {
        const rel = relative(localesRoot, file);
        this.emitFile({
          type: "asset",
          fileName: `locales/${rel.split(sep).join("/")}`,
          source: await readFile(file),
        });
      }
    },
  };
}
