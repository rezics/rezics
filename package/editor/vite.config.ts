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
        routesDirectory: 'src/mock/routes',
        generatedRouteTree: 'src/mock/routeTree.gen.ts',
      }),
      UnoCSS(),
      react(),
      // react({
      //   babel: {
      //     plugins: [['babel-plugin-react-compiler', {panicThreshold: 'none'}]],
      //   },
      // }),
      errorOverlay({
        reactPluginName: '@vitejs/plugin-react',
        forwardConsole: true,
        forwardedConsoleMethods: ['error', 'warn', 'log'],
        showBallonButton: true,
      }),
    ],
    define: {
      'process.env': env,
    },
  };
});
