import mdx from "@mdx-js/rollup";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import vike from "vike/plugin";
import { defineConfig } from "vite";

export default defineConfig({
	plugins: [vike(), mdx(), react(), tailwindcss()],
});
