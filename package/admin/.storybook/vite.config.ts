import react from "@vitejs/plugin-react";
import UnoCSS from "unocss/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [
    tsconfigPaths({ ignoreConfigErrors: true }),
    UnoCSS(),
    react(),
  ],
  define: {
    "process.env": {},
  },
});
