import mdx from "@astrojs/mdx";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

import { ABOUT_LOCALES, DEFAULT_LOCALE } from "./src/i18n/locales";

export default defineConfig({
	site: "https://about.rezics.com",
	output: "static",
	trailingSlash: "always",
	prerenderConflictBehavior: "error",
	integrations: [mdx(), react()],
	i18n: {
		defaultLocale: DEFAULT_LOCALE,
		locales: [...ABOUT_LOCALES],
		routing: {
			prefixDefaultLocale: true,
			redirectToDefaultLocale: false,
		},
	},
	vite: {
		plugins: [tailwindcss()],
		resolve: {
			dedupe: ["react", "react-dom"],
		},
	},
});
