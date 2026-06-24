import mdx from "@astrojs/mdx";
import { defineConfig } from "astro/config";
import UnoCSS from "unocss/vite";

export default defineConfig({
  site: "https://about.rezics.com",
  output: "static",
  integrations: [mdx()],
  vite: {
    plugins: [UnoCSS()],
  },
});
