import process from "node:process";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import errorOverlay from "@visulima/vite-overlay";
import react from "@vitejs/plugin-react";
import UnoCSS from "unocss/vite";
import { defineConfig, loadEnv } from "vite";

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
        routesDirectory: "src/mock/routes",
        generatedRouteTree: "src/mock/routeTree.gen.ts",
      }),
      UnoCSS(),
      react(),
      // react({
      //   babel: {
      //     plugins: [['babel-plugin-react-compiler', {panicThreshold: 'none'}]],
      //   },
      // }),
      errorOverlay({
        reactPluginName: "@vitejs/plugin-react",
        forwardConsole: true,
        forwardedConsoleMethods: ["error", "warn", "log"],
        showBallonButton: true,
      }),
    ],
    define: {
      "process.env": env,
    },
  };
});
