import {tanstackRouter} from '@tanstack/router-plugin/vite';
import UnoCSS from 'unocss/vite';
import process from 'node:process';
import {defineConfig, loadEnv} from 'vite';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';

// https://vitejs.dev/config/
export default defineConfig(({mode}) => {
  const env = loadEnv(mode, process.cwd(), 'ICS');

  return {
    plugins: [
      tanstackRouter({
        target: 'react',
        autoCodeSplitting: true,
        routesDirectory: 'src/routes',
        generatedRouteTree: 'src/routes/routeTree.gen.ts',
      }),
      UnoCSS(),
      react({
        babel: {
          plugins: ['babel-plugin-react-compiler'],
        },
      }),
      tsconfigPaths(),
    ],
    server: {
      port: 35001,
    },
    define: {
      'process.env': env,
    },
  };
});
