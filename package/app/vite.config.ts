import process from "node:process";
import { fileURLToPath } from "node:url";
import { rezicsI18nLocales } from "@rezics/i18n/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import errorOverlay from "@visulima/vite-overlay";
import react from "@vitejs/plugin-react";
import UnoCSS from "unocss/vite";
import { defineConfig, loadEnv } from "vite";
import svgr from "vite-plugin-svgr";

// import {visualizer} from 'rollup-plugin-visualizer';

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
      react(),
      // TODO Wait for plugin-react-oxc to support react compiler
      // react({
      //   babel: {
      //     plugins: [['babel-plugin-react-compiler', {panicThreshold: 'none'}]],
      //   },
      // }),
      UnoCSS(unoConfigPath),
      errorOverlay({
        reactPluginName: "@vitejs/plugin-react",
        forwardConsole: true,
        forwardedConsoleMethods: ["error", "warn", "log"],
        showBallonButton: true,
      }),
      svgr(),
      rezicsI18nLocales(),
      // visualizer({
      //   filename: 'dist/stats.html',
      //   template: 'treemap', // or sunburst / network
      //   gzipSize: true,
      //   brotliSize: true,
      //   open: true, // auto open
      // }),
    ],
    build: {
      manifest: true,
      sourcemap: true,
      rolldownOptions: {
        output: {
          // Force correct module execution order across chunks.
          // Rolldown ≤1.0.x can split chunks with incorrect initialization
          // order, causing cross-chunk imports to resolve to undefined
          // at module-eval time (rolldown#8812).
          // 强制跨 chunk 的正确模块执行顺序。
          // Rolldown ≤1.0.x 拆 chunk 时可能导致初始化顺序错误，
          // 使跨 chunk 导入在模块求值时解析为 undefined（rolldown#8812）。
          strictExecutionOrder: true,
        },
      },
    },
    server: {
      port: 35001,
      // sourcemapIgnoreList: false, // Disable sourcemap ignore list, will include all files like node_modules, etc.
    },
    define: {
      "process.env": env,
    },
  };
});
