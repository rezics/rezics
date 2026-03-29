import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: {
      entry: {
        index: resolve(__dirname, 'src/index.ts'),
        markdown: resolve(__dirname, 'src/markdown/index.ts'),
        json: resolve(__dirname, 'src/json/index.ts'),
      },
      formats: ['es'],
    },
    rollupOptions: {
      external: [
        'react',
        'react-dom',
        'react/jsx-runtime',
        /^@codemirror\//,
        /^@lezer\//,
        'markdown-it',
      ],
      output: {
        preserveModules: true,
        entryFileNames: '[name].js',
      },
    },
    target: 'es2022',
    minify: false,
  },
});
