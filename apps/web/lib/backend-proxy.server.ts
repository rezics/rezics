import { getBackendOrigin } from "./backend-origin.server";

export type BackendRoutePrefix = "api" | "image-assets";

const BlockedRequestHeaders = [
	"accept-encoding",
	"connection",
	"content-length",
	"forwarded",
	"host",
	"keep-alive",
	"proxy-authenticate",
	"proxy-authorization",
	"te",
	"trailer",
	"transfer-encoding",
	"upgrade",
	"x-forwarded-for",
	"x-forwarded-host",
	"x-forwarded-port",
	"x-forwarded-proto",
] as const;

const BlockedResponseHeaders = new Set([
	"connection",
	"content-length",
	"keep-alive",
	"proxy-authenticate",
	"proxy-authorization",
	"te",
	"trailer",
	"transfer-encoding",
	"upgrade",
]);

function createBackendUrl(
	requestUrl: URL,
	prefix: BackendRoutePrefix,
	path: readonly string[],
): URL | undefined {
	if (path.length === 0 || path.some((segment) => !segment || segment === "." || segment === ".."))
		return undefined;

	const url = new URL(
		`/${prefix}/${path.map((segment) => encodeURIComponent(segment)).join("/")}`,
		getBackendOrigin(),
	);
	url.search = requestUrl.search;
	return url;
}

function copySetCookieHeaders(source: Headers, target: Headers): void {
	const getSetCookie: unknown = Reflect.get(source, "getSetCookie");
	if (typeof getSetCookie === "function") {
		const values: unknown = Reflect.apply(getSetCookie, source, []);
		if (Array.isArray(values) && values.every((value) => typeof value === "string")) {
			for (const value of values) target.append("set-cookie", value);
			return;
		}
	}

	const value = source.get("set-cookie");
	if (value) target.append("set-cookie", value);
}

function createResponseHeaders(source: Headers, noStore: boolean): Headers {
	const headers = new Headers();
	for (const [name, value] of source) {
		const normalizedName = name.toLowerCase();
		if (normalizedName === "set-cookie" || BlockedResponseHeaders.has(normalizedName)) continue;
		headers.append(name, value);
	}
	copySetCookieHeaders(source, headers);
	if (noStore) headers.set("cache-control", "private, no-store");
	return headers;
}

export async function proxyBackendRequest(
	request: Request,
	{
		path,
		prefix,
	}: {
		readonly path: readonly string[];
		readonly prefix: BackendRoutePrefix;
	},
): Promise<Response> {
	const requestUrl = new URL(request.url);
	const targetUrl = createBackendUrl(requestUrl, prefix, path);
	if (!targetUrl) return new Response(null, { status: 400 });

	const upstreamRequest = new Request(targetUrl, request);
	for (const name of BlockedRequestHeaders) upstreamRequest.headers.delete(name);
	upstreamRequest.headers.set("accept-encoding", "identity");
	upstreamRequest.headers.set("x-forwarded-host", requestUrl.host);
	upstreamRequest.headers.set("x-forwarded-proto", requestUrl.protocol.slice(0, -1));

	try {
		const response = await fetch(
			new Request(upstreamRequest, {
				headers: upstreamRequest.headers,
				redirect: "manual",
			}),
		);
		const authRequest = prefix === "api" && path[0] === "auth";
		return new Response(response.body, {
			status: response.status,
			statusText: response.statusText,
			headers: createResponseHeaders(response.headers, authRequest),
		});
	} catch {
		return new Response(null, {
			status: 502,
			headers: { "cache-control": "private, no-store" },
		});
	}
}
