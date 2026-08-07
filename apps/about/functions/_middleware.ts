import { PRODUCT_DEFINITIONS } from "../src/content/productRegistry";
import { isAboutLocale, negotiateAboutLocale, type AboutLocale } from "../src/i18n/locales";

type PagesMiddlewareContext = {
	readonly request: Request;
	readonly next: () => Promise<Response>;
};

const publicProductSlugs: ReadonlySet<string> = new Set(
	PRODUCT_DEFINITIONS.map(({ slug }) => slug),
);

const publicEntryPaths: ReadonlySet<string> = new Set([
	"/",
	"/how-it-works",
	"/uses",
	"/products",
	"/contact-us",
]);

const legalDocumentPathPattern = /^\/legal\/[^/]+$/;
const documentationPathPattern = /^\/docs\/[^/]+(?:\/[^/]+)*$/;

function normalizePathname(pathname: string): string {
	return pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
}

function hasLocalePrefix(pathname: string): boolean {
	const firstSegment = pathname.split("/")[1];
	return firstSegment !== undefined && isAboutLocale(firstSegment);
}

function isPublicPagePath(pathname: string): boolean {
	const normalized = normalizePathname(pathname);
	if (
		publicEntryPaths.has(normalized) ||
		legalDocumentPathPattern.test(normalized) ||
		documentationPathPattern.test(normalized)
	)
		return true;

	const productMatch = normalized.match(/^\/products\/([^/]+)$/);
	const slug = productMatch?.[1];
	return slug !== undefined && publicProductSlugs.has(slug);
}

function getLocalizedPagePath(pathname: string, locale: AboutLocale): string {
	const normalized = normalizePathname(pathname);
	return normalized === "/" ? `/${locale}/` : `/${locale}${normalized}/`;
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
	if (hasLocalePrefix(url.pathname)) return context.next();

	const locale = negotiateAboutLocale(context.request.headers.get("accept-language"));
	const targetPath = isPublicPagePath(url.pathname)
		? getLocalizedPagePath(url.pathname, locale)
		: undefined;
	return targetPath ? redirect(url, targetPath) : context.next();
}
