import react from '@vitejs/plugin-react';
import {tanstackRouter} from '@tanstack/router-plugin/vite';
import UnoCSS from 'unocss/vite';
import process from 'node:process';
import {defineConfig, loadEnv} from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';

// https://vitejs.dev/config/
export default defineConfig(({mode}) => {
  const env = loadEnv(mode, process.cwd(), 'ICS');

  return {
    plugins: [
      tanstackRouter({
        target: 'react',
        autoCodeSplitting: true,
      }),
      UnoCSS(),
      react(),
      tsconfigPaths(),
    ],
    server: {
      port: 35002,
    },
    define: {
      'process.env': env,
    },
  };
});
