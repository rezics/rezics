import { PRODUCT_DEFINITIONS } from "../src/content/productRegistry";
import { DEFAULT_LOCALE } from "../src/i18n/locales";
import {
	getContactPath,
	getHomePath,
	getProductPath,
	getProductsPath,
} from "../src/i18n/productPaths";

type PagesMiddlewareContext = {
	readonly request: Request;
	readonly next: () => Response | Promise<Response>;
};

const publicProductSlugs: ReadonlySet<string> = new Set(
	PRODUCT_DEFINITIONS.map((product) => product.slug),
);

function normalizePathname(pathname: string): string {
	return pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
}

function resolveDefaultLocaleEntry(pathname: string): string | undefined {
	const normalized = normalizePathname(pathname);

	if (normalized === "/") return getHomePath(DEFAULT_LOCALE);
	if (normalized === "/products") return getProductsPath(DEFAULT_LOCALE);
	if (normalized === "/contact-us") return getContactPath(DEFAULT_LOCALE);

	const detail = normalized.match(/^\/products\/([^/]+)$/);
	const slug = detail?.[1];
	if (!slug || !publicProductSlugs.has(slug)) return undefined;

	return getProductPath(DEFAULT_LOCALE, slug);
}

function redirectResponse(requestUrl: URL, targetPath: string): Response {
	const location = new URL(targetPath, requestUrl);
	location.search = requestUrl.search;

	return new Response(null, {
		status: 302,
		headers: {
			"Cache-Control": "no-store",
			Location: location.toString(),
		},
	});
}

export async function onRequest(context: PagesMiddlewareContext): Promise<Response> {
	if (context.request.method !== "GET" && context.request.method !== "HEAD") {
		return context.next();
	}

	const url = new URL(context.request.url);
	const targetPath = resolveDefaultLocaleEntry(url.pathname);
	return targetPath ? redirectResponse(url, targetPath) : context.next();
}
