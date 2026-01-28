/* eslint-disable no-undef */
import react from '@vitejs/plugin-react';
import {tanstackRouter} from '@tanstack/router-plugin/vite';
import UnoCSS from 'unocss/vite';
import {resolve} from 'node:path';
import process from 'node:process';
import {defineConfig, loadEnv} from 'vite';

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
    ],
    server: {
      port: 35002,
    },
    resolve: {
      alias: {
        '@': resolve(__dirname, './src'),
        '@component': resolve(__dirname, './src/component'),
        '@page': resolve(__dirname, './src/page'),
        '@util': resolve(__dirname, './src/util'),
        '@locale': resolve(__dirname, './src/locale/index.ts'),
      },
    },
    define: {
      'process.env': env,
    },
  };
});
