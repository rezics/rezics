import {tanstackRouter} from '@tanstack/router-plugin/vite';
import UnoCSS from 'unocss/vite';
import process from 'node:process';
import {defineConfig, loadEnv} from 'vite';
import react from '@vitejs/plugin-react';
import errorOverlay from '@visulima/vite-overlay';

// https://vitejs.dev/config/
export default defineConfig(({mode}) => {
  const env = loadEnv(mode, process.cwd(), 'ICS');

  return {
    resolve: {
      tsconfigPaths: true,
    },
    plugins: [
      tanstackRouter({
        target: 'react',
        autoCodeSplitting: true,
        routesDirectory: 'src/routes',
        generatedRouteTree: 'src/routeTree.gen.ts',
      }),
      UnoCSS(),
      react(),
      errorOverlay({
        reactPluginName: '@vitejs/plugin-react',
        forwardConsole: true,
        forwardedConsoleMethods: ['error', 'warn', 'log'],
        showBallonButton: true,
      }),
    ],
    build: {
      // sourcemap: true, // Enable sourcemap for production build for debugging tools like Sentry
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
