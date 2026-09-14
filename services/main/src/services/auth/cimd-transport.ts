import { isPublicRoutableHost } from "@better-auth/core/utils/host";
import type { ClientMetadataResourceFetch } from "@better-auth/oauth-provider";
import { lookup } from "node:dns/promises";
import { request } from "node:https";
import { isIP } from "node:net";
import { checkServerIdentity } from "node:tls";

/** Backend-owned CIMD network settings; never accept these from a client document. @internal */
export interface CimdTransportOptions {
	/** Resolver injection for isolated network qualification; answers still pass public-address policy. */
	resolve?: (hostname: string) => Promise<readonly { address: string; family: number }[]>;
	/** Explicit trust root for a controlled deployment or isolated TLS fixture; omission uses system trust. */
	ca?: string;
	timeoutMs?: number;
	maximumConcurrentRequests?: number;
}

function abortable<T>(work: Promise<T>, signal: AbortSignal): Promise<T> {
	return new Promise((resolve, reject) => {
		const abort = () => reject(signal.reason);
		signal.addEventListener("abort", abort, { once: true });
		work.then(resolve, reject).finally(() => signal.removeEventListener("abort", abort));
		if (signal.aborted) abort();
	});
}
function canonicalAddress(address: string) {
	return isIP(address) === 6 ? new URL(`https://[${address}]/`).hostname : address;
}

/**
 * Create bounded HTTPS retrieval for CIMD documents and discovery-owned JWKS.
 * @internal
 * @remarks Resolves once, validates every answer and connects directly to one
 * public IP. Host, SNI and certificate checks retain the original hostname.
 * One instance must be shared by metadata and JWKS consumers. No plugin or
 * product client is registered by this function.
 */
export function createCimdResourceFetch(
	options: CimdTransportOptions = {},
): (...args: Parameters<ClientMetadataResourceFetch>) => Promise<Response> {
	const timeoutMs = options.timeoutMs ?? 5_000;
	const maximum = options.maximumConcurrentRequests ?? 16;
	if (
		!Number.isSafeInteger(timeoutMs) ||
		timeoutMs < 1 ||
		timeoutMs > 5_000 ||
		!Number.isSafeInteger(maximum) ||
		maximum < 1 ||
		maximum > 16
	) {
		throw new TypeError("CIMD transport limits exceed the admitted envelope");
	}
	const resolve =
		options.resolve ?? ((hostname) => lookup(hostname, { all: true, verbatim: true }));
	let active = 0;
	return async (input, init) => {
		const webRequest = new Request(input, init);
		const url = new URL(webRequest.url);
		const hostname = url.hostname.replace(/^\[|\]$/g, "");
		if (
			url.protocol !== "https:" ||
			url.username ||
			url.password ||
			url.hash ||
			!isPublicRoutableHost(hostname)
		) {
			throw new TypeError("CIMD requires a credential-free public HTTPS destination");
		}
		if (webRequest.method !== "GET" && webRequest.method !== "HEAD")
			throw new TypeError("CIMD retrieval permits only GET and HEAD");
		webRequest.signal.throwIfAborted();
		if (active >= maximum) throw new Error("CIMD transport capacity unavailable");
		active++;
		const signal = AbortSignal.any([webRequest.signal, AbortSignal.timeout(timeoutMs)]);
		// A timed-out resolver keeps its slot until it settles. Retrying cannot
		// accumulate unbounded OS DNS work that AbortSignal cannot cancel.
		const work = (async () => {
			const family = isIP(hostname);
			const addresses = family ? [{ address: hostname, family }] : await resolve(hostname);
			signal.throwIfAborted();
			if (
				!addresses.length ||
				addresses.length > 64 ||
				addresses.some(
					(answer) =>
						![4, 6].includes(answer.family) ||
						isIP(answer.address) !== answer.family ||
						!isPublicRoutableHost(answer.address),
				)
			) {
				throw new TypeError("CIMD DNS answers must all be public IP addresses");
			}
			const pinned = addresses[0]!;
			return new Promise<Response>((resolveResponse, reject) => {
				const headers = Object.fromEntries(webRequest.headers);
				headers.host = url.host;
				const outgoing = request(
					{
						protocol: "https:",
						hostname: pinned.address,
						family: pinned.family,
						port: url.port || 443,
						path: url.pathname + url.search,
						method: webRequest.method,
						headers,
						agent: false,
						signal,
						servername: family ? undefined : hostname,
						checkServerIdentity: (_host, certificate) => checkServerIdentity(hostname, certificate),
						rejectUnauthorized: true,
						ca: options.ca,
						maxHeaderSize: 16 * 1024,
					},
					(response) => {
						const peer = response.socket.remoteAddress;
						if (!peer || canonicalAddress(peer) !== canonicalAddress(pinned.address)) {
							outgoing.destroy(new Error("CIMD connected peer differs from the approved address"));
							return;
						}
						const status = response.statusCode ?? 500;
						if (status >= 300 && status < 400 && status !== 304) {
							outgoing.destroy(new Error("CIMD redirects are forbidden"));
							return;
						}
						const responseHeaders = new Headers();
						for (const [name, value] of Object.entries(response.headers)) {
							if (Array.isArray(value)) value.forEach((item) => responseHeaders.append(name, item));
							else if (value !== undefined) responseHeaders.append(name, value);
						}
						let bytes = 0;
						const chunks: Buffer[] = [];
						response.on("data", (chunk: Buffer) => {
							bytes += chunk.length;
							if (bytes > 64 * 1024) {
								const error = new Error("CIMD resource exceeds 64 KiB");
								reject(error);
								outgoing.destroy(error);
							} else chunks.push(chunk);
						});
						response.once("error", reject);
						response.once("aborted", () => reject(new Error("CIMD response ended prematurely")));
						response.once("end", () => {
							try {
								const body =
									webRequest.method === "HEAD" || [204, 205, 304].includes(status)
										? null
										: Buffer.concat(chunks);
								resolveResponse(new Response(body, { status, headers: responseHeaders }));
							} catch (error) {
								reject(error);
							}
						});
					},
				);
				outgoing.once("error", reject);
				outgoing.end();
			});
		})().finally(() => {
			active--;
		});
		return abortable(work, signal);
	};
}
