import mdx from "@astrojs/mdx";
import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://about.rezics.com",
  output: "static",
  integrations: [mdx()],
});
