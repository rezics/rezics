import { PRODUCT_DEFINITIONS } from "../src/content/productRegistry";
import { ABOUT_LOCALES } from "../src/i18n/locales";
import { getProductPath } from "../src/i18n/productPaths";
import vikeReact from "vike-react/config";
import type { Config } from "vike/types";

const redirects = Object.fromEntries(
	ABOUT_LOCALES.flatMap((locale) => [
		["/" + locale + "/product/", "/" + locale + "/products/"],
		...PRODUCT_DEFINITIONS.map((product) => [
			"/" + locale + "/product/" + product.slug + "/",
			getProductPath(locale, product.slug),
		]),
	]),
);

export default {
	extends: vikeReact,
	ssr: true,
	prerender: true,
	clientRouting: true,
	trailingSlash: true,
	redirects,
	passToClient: ["data", "is404", "statusCode"],
} satisfies Config;
