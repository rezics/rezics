import { createHash, timingSafeEqual } from "node:crypto";
import { lookup } from "node:dns/promises";
import type { IncomingHttpHeaders } from "node:http";
import { request as httpsRequest } from "node:https";
import { isIP } from "node:net";

import {
	MaximumCustomThemeDiscoveredGraphNodes,
	MaximumCustomThemeInitialCodeBytes,
} from "@rezics/block";

import { CustomThemeExternalResourceInvalid } from "../api/custom-themes/errors";

export const MaximumExternalResourceRedirects = 5;
export const ExternalResourceReviewTimeoutMilliseconds = 10_000;

export interface ExternalResourceFetchPolicy {
	readonly role: string;
	readonly integrity: string | null;
	readonly integrityWaiverReason: string | null;
	readonly allowedCorsOrigins: readonly string[];
	readonly maximumBytes?: number;
	readonly verifyIntegrity?: boolean;
}

export interface ReviewedResourceFetch {
	readonly requestedUrl: string;
	readonly finalUrl: string;
	readonly redirectChain: readonly string[];
	readonly observedSha256: string;
	readonly observedByteLength: number;
	readonly observedContentType: string;
	readonly observedAt: string;
	readonly corsAllowsAnonymous: boolean;
	readonly effectiveIntegrity: string | null;
	readonly integrityWaiverReason: string | null;
	readonly bytes: Uint8Array;
}

interface RawHttpsResponse {
	readonly statusCode: number;
	readonly headers: IncomingHttpHeaders;
	readonly bytes: Uint8Array;
}

export interface ExternalResourceFetcherDependencies {
	readonly resolveAddresses: (hostname: string) => Promise<readonly string[]>;
	readonly requestOnce: (
		url: URL,
		address: string,
		maximumBytes: number,
		timeoutMilliseconds: number,
	) => Promise<RawHttpsResponse>;
	readonly now: () => Date;
	readonly monotonicMilliseconds?: () => number;
}

function invalid(reason: string, value?: string): CustomThemeExternalResourceInvalid {
	return new CustomThemeExternalResourceInvalid({
		reason,
		...(value === undefined ? {} : { value: value.slice(0, 2_048) }),
	});
}

function normalizedUrlHostname(url: URL): string {
	const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
	return hostname.startsWith("[") && hostname.endsWith("]") ? hostname.slice(1, -1) : hostname;
}

export function parseReviewableHttpsUrl(value: string): URL {
	let url: URL;
	try {
		url = new URL(value);
	} catch {
		throw invalid("malformed_url");
	}
	if (url.protocol !== "https:") throw invalid("https_required", value);
	if (url.username || url.password) throw invalid("credentials_forbidden", value);
	if (url.hash) throw invalid("fragment_forbidden", value);
	if (url.port && url.port !== "443") throw invalid("non_default_port_forbidden", value);
	if (!url.hostname || url.hostname.length > 253) throw invalid("hostname_invalid", value);
	const hostname = normalizedUrlHostname(url);
	if (
		hostname === "localhost" ||
		hostname.endsWith(".localhost") ||
		hostname.endsWith(".local") ||
		hostname.endsWith(".internal")
	)
		throw invalid("local_hostname_forbidden", value);
	if (isIP(hostname) === 0 && !hostname.includes("."))
		throw invalid("ambiguous_single_label_hostname", value);
	return url;
}

function parseIpv4(address: string): readonly number[] | null {
	if (isIP(address) !== 4) return null;
	const octets = address.split(".").map(Number);
	return octets.length === 4 && octets.every((octet) => Number.isInteger(octet)) ? octets : null;
}

function isPublicIpv4(address: string): boolean {
	const octets = parseIpv4(address);
	if (!octets) return false;
	const [a = 0, b = 0, c = 0] = octets;
	return !(
		a === 0 ||
		a === 10 ||
		(a === 100 && b >= 64 && b <= 127) ||
		a === 127 ||
		(a === 169 && b === 254) ||
		(a === 172 && b >= 16 && b <= 31) ||
		(a === 192 && b === 0 && (c === 0 || c === 2)) ||
		(a === 192 && b === 88 && c === 99) ||
		(a === 192 && b === 168) ||
		(a === 198 && (b === 18 || b === 19)) ||
		(a === 198 && b === 51 && c === 100) ||
		(a === 203 && b === 0 && c === 113) ||
		a >= 224
	);
}

function parseIpv6(address: string): readonly number[] | null {
	if (isIP(address) !== 6 || address.includes("%")) return null;
	let input = address.toLowerCase();
	let embeddedIpv4: readonly number[] | null = null;
	const lastColon = input.lastIndexOf(":");
	if (input.includes(".")) {
		embeddedIpv4 = parseIpv4(input.slice(lastColon + 1));
		if (!embeddedIpv4) return null;
		input = `${input.slice(0, lastColon)}:${(
			(embeddedIpv4[0] ?? 0) * 256 + (embeddedIpv4[1] ?? 0)
		).toString(16)}:${((embeddedIpv4[2] ?? 0) * 256 + (embeddedIpv4[3] ?? 0)).toString(16)}`;
	}
	const halves = input.split("::");
	if (halves.length > 2) return null;
	const left = halves[0] ? halves[0].split(":") : [];
	const right = halves[1] ? halves[1].split(":") : [];
	const missing = 8 - left.length - right.length;
	if ((halves.length === 1 && missing !== 0) || (halves.length === 2 && missing < 1)) return null;
	const words = [...left, ...Array.from({ length: missing }, () => "0"), ...right].map((word) =>
		Number.parseInt(word || "0", 16),
	);
	return words.length === 8 &&
		words.every((word) => Number.isInteger(word) && word >= 0 && word <= 0xffff)
		? words
		: null;
}

function isPublicIpv6(address: string): boolean {
	const words = parseIpv6(address);
	if (!words) return false;
	const [a = 0, b = 0, c = 0, d = 0, e = 0, f = 0, g = 0, h = 0] = words;
	if (a === 0 && b === 0 && c === 0 && d === 0 && e === 0 && f === 0xffff)
		return isPublicIpv4(`${g >> 8}.${g & 255}.${h >> 8}.${h & 255}`);
	const globallyRoutablePrefix = a >= 0x2000 && a <= 0x3fff;
	const ietfProtocolAssignments = a === 0x2001 && b <= 0x01ff;
	const documentation = a === 0x2001 && b === 0x0db8;
	const documentation2024 = a === 0x3fff && (b & 0xf000) === 0;
	const sixToFour = a === 0x2002;
	return (
		globallyRoutablePrefix &&
		!ietfProtocolAssignments &&
		!documentation &&
		!documentation2024 &&
		!sixToFour
	);
}

/** True only for addresses that are safe candidates for public Internet egress. */
export function isPublicInternetAddress(address: string): boolean {
	const normalized =
		address.startsWith("[") && address.endsWith("]") ? address.slice(1, -1) : address;
	return isPublicIpv4(normalized) || isPublicIpv6(normalized);
}

async function defaultResolveAddresses(hostname: string): Promise<readonly string[]> {
	if (isIP(hostname)) return [hostname];
	const answers = await lookup(hostname, { all: true, verbatim: true });
	const addresses = [...new Set(answers.map(({ address }) => address))];
	if (!addresses.length) throw invalid("dns_no_addresses", hostname);
	return addresses;
}

function defaultRequestOnce(
	url: URL,
	address: string,
	maximumBytes: number,
	timeoutMilliseconds: number,
): Promise<RawHttpsResponse> {
	return new Promise((resolve, reject) => {
		const targetHostname = normalizedUrlHostname(url);
		const request = httpsRequest(
			{
				protocol: "https:",
				hostname: address,
				port: 443,
				method: "GET",
				path: `${url.pathname}${url.search}`,
				...(isIP(targetHostname) ? {} : { servername: targetHostname }),
				headers: {
					Host: url.host,
					Accept: "text/css, application/javascript, text/javascript, */*;q=0.1",
					"Accept-Encoding": "identity",
					"User-Agent": "REZICS-Custom-Theme-Reviewer/0",
				},
			},
			(response) => {
				const chunks: Buffer[] = [];
				let byteLength = 0;
				const declaredLength = Number(response.headers["content-length"] ?? 0);
				if (Number.isFinite(declaredLength) && declaredLength > maximumBytes) {
					response.destroy(invalid("response_too_large"));
					return;
				}
				response.on("data", (chunk: Buffer | Uint8Array) => {
					const bytes = Buffer.from(chunk);
					byteLength += bytes.byteLength;
					if (byteLength > maximumBytes) {
						response.destroy(invalid("response_too_large"));
						return;
					}
					chunks.push(bytes);
				});
				response.on("end", () =>
					resolve({
						statusCode: response.statusCode ?? 0,
						headers: response.headers,
						bytes: Buffer.concat(chunks),
					}),
				);
				response.on("error", reject);
			},
		);
		request.setTimeout(timeoutMilliseconds, () => request.destroy(invalid("request_timeout")));
		request.on("error", reject);
		request.end();
	});
}

const defaultDependencies: ExternalResourceFetcherDependencies = {
	resolveAddresses: defaultResolveAddresses,
	requestOnce: defaultRequestOnce,
	now: () => new Date(),
	monotonicMilliseconds: () => performance.now(),
};

async function withinDeadline<T>(operation: Promise<T>, timeoutMilliseconds: number): Promise<T> {
	let timeout: NodeJS.Timeout | undefined;
	try {
		return await Promise.race([
			operation,
			new Promise<never>((_resolve, reject) => {
				timeout = setTimeout(
					() => reject(invalid("request_timeout")),
					Math.max(1, Math.ceil(timeoutMilliseconds)),
				);
			}),
		]);
	} finally {
		if (timeout) clearTimeout(timeout);
	}
}

function headerValue(headers: IncomingHttpHeaders, name: string): string {
	const value = headers[name];
	return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

function corsAllowsAnonymous(
	headers: IncomingHttpHeaders,
	allowedOrigins: readonly string[],
): boolean {
	const allowed = headerValue(headers, "access-control-allow-origin").trim();
	return allowed === "*" || allowedOrigins.includes(allowed);
}

const SriStrength = { sha256: 1, sha384: 2, sha512: 3 } as const;

/** Implements the strongest-algorithm selection required by SRI metadata. */
export function verifySubresourceIntegrity(metadata: string, bytes: Uint8Array): boolean {
	const tokens = metadata
		.trim()
		.split(/\s+/)
		.map((token) => {
			const separator = token.indexOf("-");
			return {
				algorithm: token.slice(0, separator) as keyof typeof SriStrength,
				digest: token.slice(separator + 1),
			};
		});
	const strongest = Math.max(...tokens.map(({ algorithm }) => SriStrength[algorithm] ?? 0));
	if (!strongest) return false;
	return tokens
		.filter(({ algorithm }) => SriStrength[algorithm] === strongest)
		.some(({ algorithm, digest }) => {
			if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(digest))
				return false;
			const actual = createHash(algorithm).update(bytes).digest();
			let expected: Buffer;
			try {
				expected = Buffer.from(digest, "base64");
			} catch {
				return false;
			}
			return actual.length === expected.length && timingSafeEqual(actual, expected);
		});
}

function acceptsContentType(role: string, contentType: string): boolean {
	const normalized = contentType.split(";", 1)[0]?.trim().toLowerCase() ?? "";
	if (role.includes("style") || role === "css_import") return normalized === "text/css";
	if (role.includes("script") || role.includes("module") || role.includes("worker"))
		return [
			"application/javascript",
			"application/ecmascript",
			"text/javascript",
			"text/ecmascript",
		].includes(normalized);
	if (role.includes("wasm")) return normalized === "application/wasm";
	return normalized.length > 0;
}

export async function fetchReviewedExternalResource(
	requestedUrl: string,
	policy: ExternalResourceFetchPolicy,
	dependencies: ExternalResourceFetcherDependencies = defaultDependencies,
): Promise<ReviewedResourceFetch> {
	const monotonicMilliseconds = dependencies.monotonicMilliseconds ?? (() => performance.now());
	const startedAt = monotonicMilliseconds();
	const remainingMilliseconds = (): number => {
		const remaining =
			ExternalResourceReviewTimeoutMilliseconds - (monotonicMilliseconds() - startedAt);
		if (!Number.isFinite(remaining) || remaining <= 0) throw invalid("request_timeout");
		return remaining;
	};
	const maximumBytes = Math.min(
		policy.maximumBytes ?? MaximumCustomThemeInitialCodeBytes,
		MaximumCustomThemeInitialCodeBytes,
	);
	const redirectChain: string[] = [];
	let url = parseReviewableHttpsUrl(requestedUrl);
	for (let redirectCount = 0; ; redirectCount += 1) {
		const hostname = normalizedUrlHostname(url);
		const addresses = await withinDeadline(
			dependencies.resolveAddresses(hostname),
			remainingMilliseconds(),
		);
		if (!addresses.length || addresses.some((address) => !isPublicInternetAddress(address)))
			throw invalid("dns_resolved_non_public_address", hostname);
		const requestTimeoutMilliseconds = remainingMilliseconds();
		const response = await withinDeadline(
			dependencies.requestOnce(
				url,
				addresses[0] as string,
				maximumBytes,
				requestTimeoutMilliseconds,
			),
			requestTimeoutMilliseconds,
		);
		if ([301, 302, 303, 307, 308].includes(response.statusCode)) {
			if (redirectCount >= MaximumExternalResourceRedirects)
				throw invalid("too_many_redirects", requestedUrl);
			const location = headerValue(response.headers, "location");
			if (!location) throw invalid("redirect_without_location", url.href);
			redirectChain.push(url.href);
			url = parseReviewableHttpsUrl(new URL(location, url).href);
			continue;
		}
		if (response.statusCode < 200 || response.statusCode >= 300)
			throw invalid("unexpected_status", String(response.statusCode));
		if (response.bytes.byteLength > maximumBytes) throw invalid("response_too_large");
		const contentEncoding = headerValue(response.headers, "content-encoding").trim().toLowerCase();
		if (contentEncoding && contentEncoding !== "identity")
			throw invalid("compressed_response_forbidden", contentEncoding);
		const contentType = headerValue(response.headers, "content-type");
		if (!acceptsContentType(policy.role, contentType))
			throw invalid("content_type_mismatch", contentType);
		const cors = corsAllowsAnonymous(response.headers, policy.allowedCorsOrigins);
		if (policy.integrity && !cors) throw invalid("sri_requires_anonymous_cors", url.href);
		if ((policy.role.includes("module") || policy.role.includes("worker")) && !cors)
			throw invalid("module_or_worker_requires_anonymous_cors", url.href);
		if (
			policy.integrity &&
			policy.verifyIntegrity !== false &&
			!verifySubresourceIntegrity(policy.integrity, response.bytes)
		)
			throw invalid("integrity_mismatch", url.href);
		if (!policy.integrity && !policy.integrityWaiverReason)
			throw invalid("integrity_or_waiver_required", url.href);
		remainingMilliseconds();
		return {
			requestedUrl,
			finalUrl: url.href,
			redirectChain,
			observedSha256: createHash("sha256").update(response.bytes).digest("hex"),
			observedByteLength: response.bytes.byteLength,
			observedContentType: contentType,
			observedAt: dependencies.now().toISOString(),
			corsAllowsAnonymous: cors,
			effectiveIntegrity: policy.integrity,
			integrityWaiverReason: policy.integrityWaiverReason,
			bytes: response.bytes,
		};
	}
}

function resolveDiscoveredUrl(value: string, baseUrl: string): string | null {
	try {
		const url = new URL(value.trim().replace(/^['"]|['"]$/g, ""), baseUrl);
		return url.protocol === "https:" ? url.href : null;
	} catch {
		return null;
	}
}

function isBareModuleSpecifier(value: string): boolean {
	const candidate = value.trim().replace(/^['"]|['"]$/g, "");
	return !(
		candidate.startsWith("/") ||
		candidate.startsWith("./") ||
		candidate.startsWith("../") ||
		candidate.startsWith("//") ||
		/^[a-z][a-z0-9+.-]*:/i.test(candidate)
	);
}

type DiscoveredExternalDependency = {
	readonly url: string;
	readonly kind: string;
	readonly integrity?: string;
};

export interface CustomThemeLicenseInspection {
	readonly explicitlyUnlicensed: boolean;
	readonly signals: readonly string[];
}

/** Bounded extraction of machine-readable or banner license statements for review evidence. */
export function inspectCustomThemeLicenseSignals(bytes: Uint8Array): CustomThemeLicenseInspection {
	const prefixLength = Math.min(bytes.byteLength, 256 * 1_024);
	const suffixStart = Math.max(prefixLength, bytes.byteLength - 64 * 1_024);
	const decoder = new TextDecoder("utf-8", { fatal: false });
	const text = `${decoder.decode(bytes.subarray(0, prefixLength))}\n${decoder.decode(
		bytes.subarray(suffixStart),
	)}`;
	const signals = new Set<string>();
	for (const pattern of [
		/\bSPDX-License-Identifier\s*:\s*([^\r\n*]{1,160})/gi,
		/@license\b\s+([^\r\n*]{1,160})/gi,
		/\blicense\s*:\s*["']([^"'\r\n]{1,160})["']/gi,
	])
		for (const match of text.matchAll(pattern)) {
			const signal = match[1]?.trim().replace(/\s+/g, " ");
			if (signal) signals.add(signal.slice(0, 160));
			if (signals.size >= 32) break;
		}
	return {
		explicitlyUnlicensed: [...signals].some((signal) => /^unlicensed$/i.test(signal)),
		signals: [...signals],
	};
}

function importMapDependencies(
	text: string,
	baseUrl: string,
): readonly DiscoveredExternalDependency[] {
	const dependencies: DiscoveredExternalDependency[] = [];
	for (const match of text.matchAll(
		/<script\b[^>]*\btype\s*=\s*["']importmap["'][^>]*>([\s\S]*?)<\/script\s*>/gi,
	)) {
		let parsed: unknown;
		try {
			parsed = JSON.parse(match[1] ?? "");
		} catch {
			throw invalid("import_map_json_invalid");
		}
		if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed))
			throw invalid("import_map_shape_invalid");
		const map = parsed as Record<string, unknown>;
		const integrityByUrl = new Map<string, string>();
		if (
			typeof map.integrity === "object" &&
			map.integrity !== null &&
			!Array.isArray(map.integrity)
		)
			for (const [address, metadata] of Object.entries(map.integrity)) {
				const url = resolveDiscoveredUrl(address, baseUrl);
				if (url && typeof metadata === "string") integrityByUrl.set(url, metadata);
			}
		const collectMappings = (value: unknown): void => {
			if (typeof value !== "object" || value === null || Array.isArray(value)) return;
			for (const address of Object.values(value)) {
				if (typeof address !== "string") continue;
				const url = resolveDiscoveredUrl(address, baseUrl);
				if (!url) continue;
				dependencies.push({
					url,
					kind: "import_map_module",
					...(integrityByUrl.has(url) ? { integrity: integrityByUrl.get(url) } : {}),
				});
			}
		};
		collectMappings(map.imports);
		if (typeof map.scopes === "object" && map.scopes !== null && !Array.isArray(map.scopes))
			for (const scope of Object.values(map.scopes)) collectMappings(scope);
	}
	return dependencies;
}

/** Bounded best-effort dependency inventory; it is evidence, not a closure proof. */
export function discoverExternalDependencies(
	bytes: Uint8Array,
	contentType: string,
	baseUrl: string,
): readonly DiscoveredExternalDependency[] {
	const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
	const unique = new Map<string, DiscoveredExternalDependency>();
	const inventoryLimit = MaximumCustomThemeDiscoveredGraphNodes + 1;
	const remember = (value: string, kind: string, integrity?: string): void => {
		const url = resolveDiscoveredUrl(value, baseUrl);
		if (!url) return;
		if (integrity)
			for (const [existingKey, existing] of unique)
				if (existing.url === url && !existing.integrity)
					unique.set(existingKey, { ...existing, integrity });
		const key = `${kind}:${url}`;
		const current = unique.get(key);
		if (!current || (!current.integrity && integrity))
			unique.set(key, { url, kind, ...(integrity ? { integrity } : {}) });
	};
	const collect = (
		pattern: RegExp,
		kind: string,
		options: { readonly moduleSpecifier?: boolean; readonly omitData?: boolean } = {},
	): void => {
		if (unique.size >= inventoryLimit) return;
		for (const match of text.matchAll(pattern)) {
			const value = match[1];
			if (!value || (options.omitData && value.startsWith("data:"))) continue;
			if (options.moduleSpecifier && isBareModuleSpecifier(value))
				throw invalid("bare_module_specifier_unsupported", value);
			remember(value, kind);
			if (unique.size >= inventoryLimit) return;
		}
	};
	if (contentType.toLowerCase().startsWith("text/css")) {
		collect(/@import\s+(?:url\()?\s*["']?([^"')\s;]+)["']?\s*\)?/gi, "css_import");
		collect(/url\(\s*["']?([^"')]+)["']?\s*\)/gi, "css_url", { omitData: true });
	} else {
		collect(
			/\b(?:import|export)\s+(?:[^"']*?\s+from\s+)?["']([^"']+)["']/g,
			"static_module_import",
			{ moduleSpecifier: true },
		);
		collect(/\bimport\s*\(\s*["']([^"']+)["']\s*\)/g, "dynamic_module_import", {
			moduleSpecifier: true,
		});
		collect(/\b(?:Worker|SharedWorker)\s*\(\s*["']([^"']+)["']/g, "worker");
		collect(/\bimportScripts\s*\(\s*["']([^"']+)["']/g, "worker_import");
		collect(/serviceWorker\.register\s*\(\s*["']([^"']+)["']/g, "service_worker_attempt");
		collect(
			/WebAssembly\.(?:instantiateStreaming|compileStreaming)\s*\(\s*fetch\s*\(\s*["']([^"']+)["']/g,
			"wasm",
		);
		collect(/\bnew\s+URL\s*\(\s*["']([^"']+)["']\s*,\s*import\.meta\.url\s*\)/g, "module_url");
		collect(
			/createElement\s*\(\s*["']script["']\s*\)[\s\S]{0,500}?\.src\s*=\s*["']([^"']+)["']/g,
			"runtime_script",
		);
		collect(
			/createElement\s*\(\s*["']link["']\s*\)[\s\S]{0,500}?\.href\s*=\s*["']([^"']+)["']/g,
			"runtime_style",
		);
		collect(/\bfetch\s*\(\s*["']([^"']+)["']/g, "runtime_fetch");
		for (const dependency of importMapDependencies(text, baseUrl)) {
			remember(dependency.url, dependency.kind, dependency.integrity);
			if (unique.size >= inventoryLimit) break;
		}
	}
	return [...unique.values()];
}
