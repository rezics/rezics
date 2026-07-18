import { isAboutLocale, negotiateAboutLocale, type AboutLocale } from "../src/i18n/locales";
import { getHomePath, getProductPath, getProductsPath } from "../src/i18n/productPaths";

type PagesMiddlewareContext = {
	request: Request;
	next: () => Response | Promise<Response>;
};

function normalizePathname(pathname: string): string {
	return pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
}

function resolveLocalizedEntry(pathname: string, locale: AboutLocale): string | undefined {
	const normalized = normalizePathname(pathname);

	if (normalized === "/") return getHomePath(locale);
	if (normalized === "/product" || normalized === "/products") {
		return getProductsPath(locale);
	}

	const detail = normalized.match(/^\/(?:product|products)\/([^/]+)$/);
	if (!detail?.[1]) return undefined;

	return getProductPath(locale, detail[1]);
}

function resolveLocalizedLegacyPath(pathname: string): string | undefined {
	const normalized = normalizePathname(pathname);

	const legacyDirectory = normalized.match(/^\/([^/]+)\/product$/);
	if (legacyDirectory?.[1] && isAboutLocale(legacyDirectory[1])) {
		return getProductsPath(legacyDirectory[1]);
	}

	const legacyDetail = normalized.match(/^\/([^/]+)\/product\/([^/]+)$/);
	if (legacyDetail?.[1] && legacyDetail[2] && isAboutLocale(legacyDetail[1])) {
		return getProductPath(legacyDetail[1], legacyDetail[2]);
	}

	return undefined;
}

function redirectResponse(requestUrl: URL, targetPath: string, status: 301 | 302): Response {
	const location = new URL(targetPath, requestUrl);
	location.search = requestUrl.search;

	return new Response(null, {
		status,
		headers: {
			"Cache-Control": status === 301 ? "public, max-age=86400" : "no-store",
			Location: location.toString(),
			...(status === 302 ? { Vary: "Accept-Language" } : {}),
		},
	});
}

export async function onRequest(context: PagesMiddlewareContext): Promise<Response> {
	const url = new URL(context.request.url);

	if (!["GET", "HEAD"].includes(context.request.method)) {
		return context.next();
	}

	const permanentTargetPath = resolveLocalizedLegacyPath(url.pathname);
	if (permanentTargetPath) {
		return redirectResponse(url, permanentTargetPath, 301);
	}

	const locale = negotiateAboutLocale(context.request.headers.get("accept-language"));
	const targetPath = resolveLocalizedEntry(url.pathname, locale);
	if (!targetPath) return context.next();

	return redirectResponse(url, targetPath, 302);
}
