import { defineConfig } from "rolldown";

export default defineConfig({
  input: "./src/index.ts",
  output: {
    file: "./dist/index.mjs",
    format: "esm",
    sourcemap: true,
    cleanDir: true,
    codeSplitting: true,
    keepNames: true,
    minify: true,
  },
  platform: "node",
  external: [/^[^./]/],
});
