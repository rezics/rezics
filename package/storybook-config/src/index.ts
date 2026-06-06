import type { StorybookConfig } from "@storybook/react-vite";
import react from "@vitejs/plugin-react";
import {
  mergeConfig,
  type Plugin,
  type PluginOption,
  type UserConfig,
} from "vite";

export type StorybookConfigOverrides = Partial<StorybookConfig>;

/**
 * Storybook 10's manager probes `/stories.json` (v6 manifest name) and
 * `/metadata.json` (pre-v6 metadata) when resolving a composed ref, even
 * though v10's core-server only emits `/index.json` and `/project.json`.
 * `manager-api/index.js`'s `checkRef` succeeds if *either* `index.json` or
 * `stories.json` responds, and the `metadata.json` fetch is `.catch`ed.
 *
 * The functional outcome is fine, but those manager probes fall through to Vite's
 * 404 catchall which emits no CORS headers. The manager fetches with
 * `credentials: "include"`, so the browser raises a console-visible CORS
 * error before the 404 is observable. The error is cosmetic — refs still
 * load via `index.json` — but it floods the console.
 *
 * This plugin intercepts the two manager probe paths in dev mode and returns a
 * CORS-correct 404. The manager's `handleRequest` treats the 404 as
 * `indexError`, falls back to `index.json`, and the network panel shows a
 * gray 404 with no JS-level error.
 */
const STORYBOOK_MANAGER_PROBE_ENDPOINTS = new Set([
  "/stories.json",
  "/metadata.json",
]);

function corsManagerProbeEndpointsPlugin(): Plugin {
  return {
    name: "rezics-storybook-cors-manager-probe-endpoints",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = (req.url ?? "").split("?")[0];
        if (!STORYBOOK_MANAGER_PROBE_ENDPOINTS.has(path)) {
          next();
          return;
        }
        const origin = req.headers.origin;
        if (typeof origin === "string") {
          res.setHeader("Access-Control-Allow-Origin", origin);
          res.setHeader("Access-Control-Allow-Credentials", "true");
          res.setHeader("Vary", "Origin");
        }
        res.setHeader("Content-Type", "application/json");
        res.statusCode = 404;
        res.end(
          JSON.stringify({
            error: "endpoint removed in storybook 10",
            replacement:
              path === "/stories.json" ? "/index.json" : "/project.json",
          }),
        );
      });
    },
  };
}

export function baseStorybookConfig(
  overrides: StorybookConfigOverrides = {},
): StorybookConfig {
  const { framework, typescript, core, ...rest } = overrides;

  return {
    stories: ["../src/**/*.mdx", "../src/**/*.stories.@(ts|tsx|mdx)"],
    addons: ["@storybook/addon-docs", "@storybook/addon-a11y"],
    ...rest,
    framework: {
      name: "@storybook/react-vite",
      options: {
        builder: {
          viteConfigPath: ".storybook/vite.config.ts",
        },
      },
      ...(framework as object | undefined),
    } as StorybookConfig["framework"],
    core: {
      disableTelemetry: true,
      ...core,
    },
    typescript: {
      check: false,
      reactDocgen: "react-docgen-typescript",
      reactDocgenTypescriptOptions: {
        shouldExtractLiteralValuesFromEnum: true,
        shouldRemoveUndefinedFromOptional: true,
        savePropValueAsString: true,
        propFilter: (prop) =>
          prop.parent
            ? !/node_modules\/(?!@rezics)/.test(prop.parent.fileName)
            : true,
      },
      ...typescript,
    },
  };
}

export interface BaseStorybookViteOptions {
  /**
   * Disable UnoCSS for hosts that don't render Uno-classed content
   * (e.g. the composition host or a CodeMirror-only editor preview).
   * When false, `unocss` need not be installed in the consuming package.
   */
  uno?: boolean;
  unoConfigPath?: string;
}

export async function baseStorybookViteConfig(
  options: BaseStorybookViteOptions = {},
  overrides: UserConfig = {},
): Promise<UserConfig> {
  const { uno = true, unoConfigPath } = options;

  const plugins: PluginOption[] = [corsManagerProbeEndpointsPlugin()];
  if (uno) {
    const { default: UnoCSS } = await import("unocss/vite");
    plugins.push(UnoCSS(unoConfigPath));
  }
  plugins.push(...react());

  return mergeConfig(
    {
      resolve: {
        tsconfigPaths: true,
      },
      plugins,
      define: {
        "process.env": {},
      },
    } satisfies UserConfig,
    overrides,
  );
}
