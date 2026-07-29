import mdx from "@mdx-js/rollup";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import vike from "vike/plugin";
import { defineConfig } from "vite";

import { productMetadataPlugin } from "./src/content/productMetadataPlugin";

export default defineConfig({
	plugins: [vike(), productMetadataPlugin(), mdx(), react(), tailwindcss()],
});
