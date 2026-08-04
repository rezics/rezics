import { PRODUCT_DEFINITIONS } from "../src/content/productRegistry";
import { DEFAULT_LOCALE, negotiateAboutLocale, type AboutLocale } from "../src/i18n/locales";
import {
	getContactPath,
	getHomePath,
	getHowItWorksPath,
	getProductPath,
	getProductsPath,
	getUsesPath,
} from "../src/i18n/productPaths";

type PagesMiddlewareContext = {
	readonly request: Request;
	readonly next: () => Promise<Response>;
};

const publicProductSlugs: ReadonlySet<string> = new Set(
	PRODUCT_DEFINITIONS.map(({ slug }) => slug),
);

function normalizePathname(pathname: string): string {
	return pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
}

function resolveLocalizedEntry(pathname: string, locale: AboutLocale): string | undefined {
	const normalized = normalizePathname(pathname);
	if (normalized === "/") return getHomePath(locale);
	if (normalized === "/how-it-works") return getHowItWorksPath(locale);
	if (normalized === "/uses") return getUsesPath(locale);
	if (normalized === "/products") return getProductsPath(locale);
	if (normalized === "/contact-us") return getContactPath(DEFAULT_LOCALE);

	const productMatch = normalized.match(/^\/products\/([^/]+)$/);
	const slug = productMatch?.[1];
	return slug && publicProductSlugs.has(slug) ? getProductPath(locale, slug) : undefined;
}

function redirect(requestUrl: URL, targetPath: string): Response {
	const location = new URL(targetPath, requestUrl);
	location.search = requestUrl.search;
	return new Response(null, {
		status: 302,
		headers: {
			"Cache-Control": "no-store",
			Location: location.toString(),
			Vary: "Accept-Language",
		},
	});
}

export async function onRequest(context: PagesMiddlewareContext): Promise<Response> {
	if (context.request.method !== "GET" && context.request.method !== "HEAD") {
		return context.next();
	}

	const url = new URL(context.request.url);
	const locale = negotiateAboutLocale(context.request.headers.get("accept-language"));
	const targetPath = resolveLocalizedEntry(url.pathname, locale);
	return targetPath ? redirect(url, targetPath) : context.next();
}
