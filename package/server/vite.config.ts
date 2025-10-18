/// <reference types="vitest" />
import { defineConfig } from "vite";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "~encore": path.resolve(__dirname, "./encore.gen"),
      "@/*": path.resolve(__dirname, "./*")
    },
  },
  // Disable file-level parallelism for VSCode Vitest plugin compatibility.
  test: {
    fileParallelism: false,
    environment: "node",
  },
});


