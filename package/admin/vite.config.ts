import process from "node:process";
import { fileURLToPath } from "node:url";
import { rezicsI18nLocales } from "@rezics/i18n/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import errorOverlay from "@visulima/vite-overlay";
import react from "@vitejs/plugin-react";
import UnoCSS from "unocss/vite";
import { defineConfig, loadEnv } from "vite";

const unoConfigPath = fileURLToPath(
  new URL("./uno.config.ts", import.meta.url),
);

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "ICS");

  return {
    resolve: {
      tsconfigPaths: true,
    },
    plugins: [
      tanstackRouter({
        target: "react",
        autoCodeSplitting: true,
        routesDirectory: "src/routes",
        generatedRouteTree: "src/routeTree.gen.ts",
      }),
      UnoCSS(unoConfigPath),
      react(),
      errorOverlay({
        reactPluginName: "@vitejs/plugin-react",
        forwardConsole: true,
        forwardedConsoleMethods: ["error", "warn", "log"],
        showBallonButton: true,
      }),
      rezicsI18nLocales(),
    ],
    build: {
      // sourcemap: true, // Enable sourcemap for production build for debugging tools like Sentry
    },
    server: {
      port: 35002,
      // sourcemapIgnoreList: false, // Disable sourcemap ignore list, will include all files like node_modules, etc.
    },
    define: {
      "process.env": env,
    },
  };
});
