import { TopLevelSlugNamespaceUnitIds, isSlugLabel } from "@rezics/slug";

const UuidPattern =
	/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;
const MaximumPolicyBytes = 16 * 1_024;
const PolicyTimeoutMilliseconds = 2_000;

export const PresentationRevisionRequestHeader = "x-rezics-presentation-revision";
export const NonceRequestHeader = "x-nonce";
export const PresentationPolicyProbePath = "/__rezics/presentation-policy";

export interface PresentationPolicy {
	readonly revisionId: string | null;
	readonly scriptOrigins: readonly string[];
	readonly styleOrigins: readonly string[];
	readonly connectOrigins: readonly string[];
	readonly imageOrigins: readonly string[];
	readonly fontOrigins: readonly string[];
	readonly frameOrigins: readonly string[];
	readonly mediaOrigins: readonly string[];
}

const EmptyPresentationPolicy: PresentationPolicy = {
	revisionId: null,
	scriptOrigins: [],
	styleOrigins: [],
	connectOrigins: [],
	imageOrigins: [],
	fontOrigins: [],
	frameOrigins: [],
	mediaOrigins: [],
};

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function parseOriginList(value: unknown, allowBlob: boolean): readonly string[] | undefined {
	if (!Array.isArray(value) || value.length > 128) return undefined;
	const origins = new Set<string>();
	for (const candidate of value) {
		if (candidate === "blob:" && allowBlob) {
			origins.add(candidate);
			continue;
		}
		if (typeof candidate !== "string") return undefined;
		try {
			const url = new URL(candidate);
			if (url.protocol !== "https:" || candidate !== url.origin) return undefined;
			origins.add(candidate);
		} catch {
			return undefined;
		}
	}
	return [...origins];
}

export function parsePresentationPolicy(value: unknown): PresentationPolicy | undefined {
	if (!isObject(value)) return undefined;
	const revisionId = value.revisionId;
	if (!(revisionId === null || (typeof revisionId === "string" && UuidPattern.test(revisionId))))
		return undefined;
	const scriptOrigins = parseOriginList(value.scriptOrigins, true);
	const styleOrigins = parseOriginList(value.styleOrigins, true);
	const connectOrigins = parseOriginList(value.connectOrigins, false);
	const imageOrigins = parseOriginList(value.imageOrigins, false);
	const fontOrigins = parseOriginList(value.fontOrigins, false);
	const frameOrigins = parseOriginList(value.frameOrigins, false);
	const mediaOrigins = parseOriginList(value.mediaOrigins, false);
	if (
		!scriptOrigins ||
		!styleOrigins ||
		!connectOrigins ||
		!imageOrigins ||
		!fontOrigins ||
		!frameOrigins ||
		!mediaOrigins
	)
		return undefined;
	const resourceCount =
		scriptOrigins.length +
		styleOrigins.length +
		connectOrigins.length +
		imageOrigins.length +
		fontOrigins.length +
		frameOrigins.length +
		mediaOrigins.length;
	if (resourceCount > 256) return undefined;
	if (revisionId === null && resourceCount > 0) return undefined;
	return {
		revisionId,
		scriptOrigins,
		styleOrigins,
		connectOrigins,
		imageOrigins,
		fontOrigins,
		frameOrigins,
		mediaOrigins,
	};
}

async function readBoundedJson(response: Response): Promise<unknown> {
	const declaredLength = response.headers.get("content-length");
	if (declaredLength && Number(declaredLength) > MaximumPolicyBytes)
		throw new Error("presentation policy exceeds its response bound");
	if (!response.body) throw new Error("presentation policy has no response body");
	const reader = response.body.getReader();
	const chunks: Uint8Array[] = [];
	let length = 0;
	try {
		for (;;) {
			const { done, value } = await reader.read();
			if (done) break;
			length += value.byteLength;
			if (length > MaximumPolicyBytes)
				throw new Error("presentation policy exceeds its response bound");
			chunks.push(value);
		}
	} catch (error) {
		await reader.cancel(error).catch(() => undefined);
		throw error;
	}
	const bytes = new Uint8Array(length);
	let offset = 0;
	for (const chunk of chunks) {
		bytes.set(chunk, offset);
		offset += chunk.byteLength;
	}
	return JSON.parse(new TextDecoder().decode(bytes));
}

function backendOrigin(environment: Pick<Cloudflare.Env, "REZICS_API_ORIGIN">): URL {
	const url = new URL(environment.REZICS_API_ORIGIN);
	if (
		(url.protocol !== "http:" && url.protocol !== "https:") ||
		url.pathname !== "/" ||
		url.search ||
		url.hash
	)
		throw new Error("REZICS_API_ORIGIN must be an HTTP(S) origin");
	return url;
}

async function fetchPolicyJson(
	url: URL,
	request: Request,
	fetcher: typeof fetch,
): Promise<unknown> {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), PolicyTimeoutMilliseconds);
	const headers = new Headers({ accept: "application/json", "accept-encoding": "identity" });
	const cookie = request.headers.get("cookie");
	if (cookie) headers.set("cookie", cookie);
	try {
		const response = await fetcher(url, {
			headers,
			redirect: "manual",
			signal: controller.signal,
		});
		if (!response.ok) throw new Error(`presentation policy returned ${response.status}`);
		return await readBoundedJson(response);
	} finally {
		clearTimeout(timeout);
	}
}

function pathSegments(url: URL): readonly string[] {
	try {
		return url.pathname
			.split("/")
			.filter(Boolean)
			.map((segment) => decodeURIComponent(segment));
	} catch {
		return [];
	}
}

export function isDocumentRequest(request: Request): boolean {
	if (request.method !== "GET") return false;
	if (request.headers.get("purpose") === "prefetch") return false;
	if (request.headers.has("next-router-prefetch")) return false;
	return (
		request.headers.get("sec-fetch-dest") === "document" ||
		request.headers.get("accept")?.includes("text/html") === true
	);
}

async function resolveZoneHostId(
	request: Request,
	environment: Pick<Cloudflare.Env, "REZICS_API_ORIGIN">,
	fetcher: typeof fetch,
): Promise<string | undefined> {
	const url = new URL(request.url);
	const segments = pathSegments(url);
	if (segments[0] === "zone") {
		if (!segments[1] || !UuidPattern.test(segments[1]) || segments[2] === "manage")
			return undefined;
		return segments[1];
	}
	if (segments[0] !== "z" || !segments[1] || !isSlugLabel(segments[1])) return undefined;
	const slugUrl = new URL(
		`/api/v1/slug-addresses/scopes/${TopLevelSlugNamespaceUnitIds.zones}/${encodeURIComponent(segments[1])}`,
		backendOrigin(environment),
	);
	slugUrl.searchParams.set("kind", "zone");
	const value = await fetchPolicyJson(slugUrl, request, fetcher);
	return isObject(value) && typeof value.id === "string" && UuidPattern.test(value.id)
		? value.id
		: undefined;
}

async function resolvePresentationPolicyForHost(
	hostUnitId: string,
	request: Request,
	environment: Pick<Cloudflare.Env, "REZICS_API_ORIGIN">,
	fetcher: typeof fetch,
): Promise<PresentationPolicy> {
	const policyUrl = new URL(
		`/api/v1/units/by-id/${encodeURIComponent(hostUnitId)}/presentation-policy`,
		backendOrigin(environment),
	);
	policyUrl.searchParams.set("safeMode", "false");
	const policy = parsePresentationPolicy(await fetchPolicyJson(policyUrl, request, fetcher));
	if (!policy) throw new Error("presentation policy response is invalid");
	return policy;
}

export function isPresentationPolicyProbeRequest(request: Request): boolean {
	return request.method === "GET" && new URL(request.url).pathname === PresentationPolicyProbePath;
}

/**
 * Rechecks the exact host policy for an already-open document. The response
 * intentionally omits resource origins and is never cacheable across viewers.
 */
export async function handlePresentationPolicyProbeRequest(
	request: Request,
	environment: Pick<Cloudflare.Env, "REZICS_API_ORIGIN">,
	fetcher: typeof fetch = fetch,
): Promise<Response> {
	const requestUrl = new URL(request.url);
	const parameters = [...requestUrl.searchParams.keys()];
	const hostUnitId = requestUrl.searchParams.get("hostUnitId");
	if (parameters.length !== 1 || parameters[0] !== "hostUnitId" || !hostUnitId)
		return Response.json({ error: "request_invalid" }, { status: 400 });
	if (!UuidPattern.test(hostUnitId))
		return Response.json({ error: "request_invalid" }, { status: 400 });
	try {
		const policy = await resolvePresentationPolicyForHost(
			hostUnitId,
			request,
			environment,
			fetcher,
		);
		return Response.json(
			{ revisionId: policy.revisionId },
			{
				headers: {
					"cache-control": "private, no-store",
					"cross-origin-resource-policy": "same-origin",
					vary: "Cookie",
					"x-content-type-options": "nosniff",
				},
			},
		);
	} catch (error) {
		console.error(
			JSON.stringify({
				event: "presentation_policy_probe_failed",
				hostUnitId,
				message: error instanceof Error ? error.message : "unknown error",
			}),
		);
		return Response.json(
			{ revisionId: null },
			{ status: 503, headers: { "cache-control": "private, no-store", vary: "Cookie" } },
		);
	}
}

export async function resolvePresentationPolicyForRequest(
	request: Request,
	environment: Pick<Cloudflare.Env, "REZICS_API_ORIGIN">,
	fetcher: typeof fetch = fetch,
): Promise<PresentationPolicy> {
	if (!isDocumentRequest(request)) return EmptyPresentationPolicy;
	const requestUrl = new URL(request.url);
	if (requestUrl.searchParams.get("rezics-safe-theme") === "1") return EmptyPresentationPolicy;
	const hostUnitId = await resolveZoneHostId(request, environment, fetcher);
	if (!hostUnitId) return EmptyPresentationPolicy;
	return resolvePresentationPolicyForHost(hostUnitId, request, environment, fetcher);
}

function directive(name: string, sources: readonly string[]): string {
	return `${name} ${[...new Set(sources)].join(" ")}`;
}

export function contentSecurityPolicy(input: {
	readonly development: boolean;
	readonly fontAwesomeCssUrl?: string;
	readonly nonce: string;
	readonly policy: PresentationPolicy;
	readonly secureRequest: boolean;
}): string {
	const fontAwesomeOrigin = input.fontAwesomeCssUrl
		? new URL(input.fontAwesomeCssUrl).origin
		: undefined;
	const scriptSources = [
		"'self'",
		`'nonce-${input.nonce}'`,
		"'wasm-unsafe-eval'",
		...(input.development ? ["'unsafe-eval'"] : []),
		"https://challenges.cloudflare.com",
		...input.policy.scriptOrigins,
	];
	const styleSources = [
		"'self'",
		`'nonce-${input.nonce}'`,
		"https://fonts.googleapis.com",
		...(fontAwesomeOrigin ? [fontAwesomeOrigin] : []),
		...input.policy.styleOrigins,
	];
	const directives = [
		directive("default-src", ["'self'"]),
		directive("script-src", scriptSources),
		directive("script-src-attr", ["'none'"]),
		directive("style-src", styleSources),
		directive("style-src-attr", ["'unsafe-inline'"]),
		directive("connect-src", [
			"'self'",
			"https://challenges.cloudflare.com",
			...input.policy.connectOrigins,
		]),
		directive("img-src", ["'self'", "data:", "blob:", ...input.policy.imageOrigins]),
		directive("font-src", [
			"'self'",
			"data:",
			"https://fonts.gstatic.com",
			...(fontAwesomeOrigin ? [fontAwesomeOrigin] : []),
			...input.policy.fontOrigins,
		]),
		directive("media-src", ["'self'", "blob:", ...input.policy.mediaOrigins]),
		directive("worker-src", ["'self'", "blob:", ...input.policy.scriptOrigins]),
		directive("frame-src", ["https://challenges.cloudflare.com", ...input.policy.frameOrigins]),
		directive("object-src", ["'none'"]),
		directive("base-uri", ["'self'"]),
		directive("form-action", ["'self'"]),
		directive("frame-ancestors", ["'none'"]),
		directive("manifest-src", ["'self'"]),
		"report-to rezics-csp",
		"report-uri /__rezics/security-report",
	];
	if (input.secureRequest) directives.push("upgrade-insecure-requests");
	return directives.map((value) => `${value};`).join(" ");
}
