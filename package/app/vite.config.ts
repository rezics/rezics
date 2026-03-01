import {tanstackRouter} from '@tanstack/router-plugin/vite';
import UnoCSS from 'unocss/vite';
import process from 'node:process';
import {defineConfig, loadEnv} from 'vite';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';
import errorOverlay from '@visulima/vite-overlay';
import svgr from 'vite-plugin-svgr';
import {visualizer} from 'rollup-plugin-visualizer';

// https://vitejs.dev/config/
export default defineConfig(({mode}) => {
  const env = loadEnv(mode, process.cwd(), 'ICS');

  return {
    plugins: [
      tanstackRouter({
        target: 'react',
        autoCodeSplitting: true,
        routesDirectory: 'src/routes',
        generatedRouteTree: 'src/routeTree.gen.ts',
      }),
      react(),
      // TODO Wait for plugin-react-oxc to support react compiler
      // react({
      //   babel: {
      //     plugins: [['babel-plugin-react-compiler', {panicThreshold: 'none'}]],
      //   },
      // }),
      UnoCSS(),
      tsconfigPaths(),
      errorOverlay({
        reactPluginName: '@vitejs/plugin-react',
        forwardConsole: true,
        forwardedConsoleMethods: ['error', 'warn', 'log'],
        showBallonButton: true,
      }),
      svgr(),
      visualizer({
        filename: 'dist/stats.html',
        template: 'treemap', // or sunburst / network
        gzipSize: true,
        brotliSize: true,
        open: true, // auto open
      }),
    ],
    build: {
      manifest: true,
      sourcemap: true, // Enable sourcemap for production build for debugging tools like Sentry
      rollupOptions: {
        output: {},
      },
    },
    server: {
      port: 35001,
      // sourcemapIgnoreList: false, // Disable sourcemap ignore list, will include all files like node_modules, etc.
    },
    define: {
      'process.env': env,
    },
  };
});
