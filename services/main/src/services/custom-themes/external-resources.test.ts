import { createHash } from "node:crypto";

import { MaximumCustomThemeDiscoveredGraphNodes } from "@rezics/block";
import { describe, expect, it, vi } from "vitest";

import {
	fetchReviewedExternalResource,
	discoverExternalDependencies,
	inspectCustomThemeLicenseSignals,
	isPublicInternetAddress,
	parseReviewableHttpsUrl,
	verifySubresourceIntegrity,
	type ExternalResourceFetcherDependencies,
} from "./external-resources";

const body = new TextEncoder().encode("export const reviewed = true;");

function dependencies(
	overrides: Partial<ExternalResourceFetcherDependencies> = {},
): ExternalResourceFetcherDependencies {
	return {
		resolveAddresses: vi.fn(async () => ["1.1.1.1"]),
		requestOnce: vi.fn(async () => ({
			statusCode: 200,
			headers: {
				"content-type": "text/javascript; charset=utf-8",
				"access-control-allow-origin": "*",
			},
			bytes: body,
		})),
		now: () => new Date("2026-08-29T00:00:00.000Z"),
		...overrides,
	};
}

const waivedPolicy = {
	role: "classic_script_direct",
	integrity: null,
	integrityWaiverReason: "Reviewed mutable dependency",
	allowedCorsOrigins: ["https://rezics.example"],
} as const;

describe("Custom Theme external-resource review boundary", () => {
	it("accepts canonical public HTTPS hosts, including bracketed IPv6 literals", () => {
		expect(parseReviewableHttpsUrl("https://cdn.example.test/theme.js").hostname).toBe(
			"cdn.example.test",
		);
		expect(parseReviewableHttpsUrl("https://[2606:4700:4700::1111]/theme.js").protocol).toBe(
			"https:",
		);
	});

	it.each([
		"http://cdn.example.test/theme.js",
		"https://user:secret@cdn.example.test/theme.js",
		"https://cdn.example.test:8443/theme.js",
		"https://cdn.example.test/theme.js#fragment",
		"https://localhost/theme.js",
		"https://service/theme.js",
	])("rejects URL forms that can bypass the outbound policy: %s", (url) => {
		expect(() => parseReviewableHttpsUrl(url)).toThrow();
	});

	it.each([
		["1.1.1.1", true],
		["192.1.2.3", true],
		["2606:4700:4700::1111", true],
		["[2606:4700:4700::1111]", true],
		["0.0.0.0", false],
		["10.0.0.1", false],
		["100.64.0.1", false],
		["127.0.0.1", false],
		["169.254.169.254", false],
		["172.31.0.1", false],
		["192.0.2.1", false],
		["192.168.0.1", false],
		["198.18.0.1", false],
		["198.51.100.1", false],
		["203.0.113.1", false],
		["224.0.0.1", false],
		["::1", false],
		["fc00::1", false],
		["fe80::1", false],
		["2001:db8::1", false],
		["2001::1", false],
		["2001:1::4", false],
		["2002::1", false],
		["3fff::1", false],
	])("classifies %s as public=%s", (address, expected) => {
		expect(isPublicInternetAddress(address)).toBe(expected);
	});

	it("rejects a DNS answer set if any address is non-public", async () => {
		const requestOnce = vi.fn();
		await expect(
			fetchReviewedExternalResource(
				"https://cdn.example.test/theme.js",
				waivedPolicy,
				dependencies({
					resolveAddresses: vi.fn(async () => ["1.1.1.1", "127.0.0.1"]),
					requestOnce,
				}),
			),
		).rejects.toMatchObject({ details: { reason: "dns_resolved_non_public_address" } });
		expect(requestOnce).not.toHaveBeenCalled();
	});

	it("re-resolves and rejects every redirect hop before following it", async () => {
		const resolveAddresses = vi
			.fn<ExternalResourceFetcherDependencies["resolveAddresses"]>()
			.mockResolvedValueOnce(["1.1.1.1"])
			.mockResolvedValueOnce(["10.0.0.1"]);
		const requestOnce = vi.fn(async () => ({
			statusCode: 302,
			headers: { location: "https://internal.example.test/theme.js" },
			bytes: new Uint8Array(),
		}));
		await expect(
			fetchReviewedExternalResource(
				"https://cdn.example.test/theme.js",
				waivedPolicy,
				dependencies({ resolveAddresses, requestOnce }),
			),
		).rejects.toMatchObject({ details: { reason: "dns_resolved_non_public_address" } });
		expect(resolveAddresses).toHaveBeenNthCalledWith(2, "internal.example.test");
		expect(requestOnce).toHaveBeenCalledTimes(1);
	});

	it("enforces MIME, CORS, and the aggregate byte cap after the transport returns", async () => {
		const integrity = `sha384-${createHash("sha384").update(body).digest("base64")}`;
		await expect(
			fetchReviewedExternalResource(
				"https://cdn.example.test/theme.js",
				{ ...waivedPolicy, integrity, integrityWaiverReason: null },
				dependencies({
					requestOnce: vi.fn(async () => ({
						statusCode: 200,
						headers: { "content-type": "text/css" },
						bytes: body,
					})),
				}),
			),
		).rejects.toMatchObject({ details: { reason: "content_type_mismatch" } });

		await expect(
			fetchReviewedExternalResource(
				"https://cdn.example.test/theme.js",
				{ ...waivedPolicy, maximumBytes: 1 },
				dependencies(),
			),
		).rejects.toMatchObject({ details: { reason: "response_too_large" } });
	});

	it("records a bounded successful observation without response payload ambiguity", async () => {
		const result = await fetchReviewedExternalResource(
			"https://cdn.example.test/theme.js",
			waivedPolicy,
			dependencies(),
		);
		expect(result).toMatchObject({
			requestedUrl: "https://cdn.example.test/theme.js",
			finalUrl: "https://cdn.example.test/theme.js",
			observedByteLength: body.byteLength,
			observedContentType: "text/javascript; charset=utf-8",
			observedAt: "2026-08-29T00:00:00.000Z",
			corsAllowsAnonymous: true,
		});
		expect(result.observedSha256).toBe(createHash("sha256").update(body).digest("hex"));
	});

	it("rejects encoded responses before any decompression and rejects pinned resources without CORS", async () => {
		await expect(
			fetchReviewedExternalResource(
				"https://cdn.example.test/theme.js",
				waivedPolicy,
				dependencies({
					requestOnce: vi.fn(async () => ({
						statusCode: 200,
						headers: {
							"content-type": "text/javascript",
							"content-encoding": "gzip",
						},
						bytes: body,
					})),
				}),
			),
		).rejects.toMatchObject({ details: { reason: "compressed_response_forbidden" } });

		const integrity = `sha384-${createHash("sha384").update(body).digest("base64")}`;
		await expect(
			fetchReviewedExternalResource(
				"https://cdn.example.test/theme.js",
				{ ...waivedPolicy, integrity, integrityWaiverReason: null },
				dependencies({
					requestOnce: vi.fn(async () => ({
						statusCode: 200,
						headers: { "content-type": "text/javascript" },
						bytes: body,
					})),
				}),
			),
		).rejects.toMatchObject({ details: { reason: "sri_requires_anonymous_cors" } });
	});

	it("bounds redirects and accepts non-code CSS dependencies with their observed MIME", async () => {
		await expect(
			fetchReviewedExternalResource(
				"https://cdn.example.test/theme.js",
				waivedPolicy,
				dependencies({
					requestOnce: vi.fn(async () => ({
						statusCode: 302,
						headers: { location: "/theme.js" },
						bytes: new Uint8Array(),
					})),
				}),
			),
		).rejects.toMatchObject({ details: { reason: "too_many_redirects" } });

		await expect(
			fetchReviewedExternalResource(
				"https://cdn.example.test/background.png",
				{ ...waivedPolicy, role: "css_url" },
				dependencies({
					requestOnce: vi.fn(async () => ({
						statusCode: 200,
						headers: { "content-type": "image/png" },
						bytes: new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
					})),
				}),
			),
		).resolves.toMatchObject({ observedContentType: "image/png" });
	});

	it("enforces one absolute deadline across DNS resolution and redirect hops", async () => {
		let elapsedMilliseconds = 0;
		const resolveAddresses = vi.fn(async () => {
			elapsedMilliseconds += 3_000;
			return ["1.1.1.1"];
		});
		const requestOnce = vi
			.fn<ExternalResourceFetcherDependencies["requestOnce"]>()
			.mockImplementationOnce(async () => {
				elapsedMilliseconds += 3_000;
				return {
					statusCode: 302,
					headers: { location: "https://cdn.example.test/final.js" },
					bytes: new Uint8Array(),
				};
			})
			.mockImplementationOnce(async () => {
				elapsedMilliseconds += 3_000;
				return {
					statusCode: 200,
					headers: {
						"content-type": "text/javascript",
						"access-control-allow-origin": "*",
					},
					bytes: body,
				};
			});
		await expect(
			fetchReviewedExternalResource(
				"https://cdn.example.test/theme.js",
				waivedPolicy,
				dependencies({
					resolveAddresses,
					requestOnce,
					monotonicMilliseconds: () => elapsedMilliseconds,
				}),
			),
		).rejects.toMatchObject({ details: { reason: "request_timeout" } });
		expect(requestOnce.mock.calls[0]?.[3]).toBe(7_000);
		expect(requestOnce.mock.calls[1]?.[3]).toBe(1_000);
	});
});

describe("Subresource Integrity verification", () => {
	it("uses only the strongest algorithm present in the metadata", () => {
		const sha256 = createHash("sha256").update(body).digest("base64");
		const sha384 = createHash("sha384").update(body).digest("base64");
		expect(verifySubresourceIntegrity(`sha256-invalid sha384-${sha384}`, body)).toBe(true);
		expect(verifySubresourceIntegrity(`sha256-${sha256} sha384-invalid`, body)).toBe(false);
	});

	it("rejects unsupported and non-canonical digest encodings", () => {
		const sha384 = createHash("sha384").update(body).digest("base64");
		expect(verifySubresourceIntegrity(`md5-${sha384}`, body)).toBe(false);
		expect(verifySubresourceIntegrity(`sha384-${sha384}!!!`, body)).toBe(false);
	});
});

describe("bounded license inspection", () => {
	it("extracts review signals and flags explicit unlicensed markers", () => {
		const inspected = inspectCustomThemeLicenseSignals(
			new TextEncoder().encode(
				"/* SPDX-License-Identifier: MIT */\n/* @license Example-1.0 */\nlicense: 'UNLICENSED'",
			),
		);
		expect(inspected).toEqual({
			explicitlyUnlicensed: true,
			signals: ["MIT", "Example-1.0", "UNLICENSED"],
		});
	});
});

describe("bounded external dependency discovery", () => {
	it("inventories CSS imports and resource URLs while omitting inline data", () => {
		const dependencies = discoverExternalDependencies(
			new TextEncoder().encode(
				'@import "./base.css"; .hero { background: url("../hero.webp") } .icon { background: url(data:image/png;base64,AA==) }',
			),
			"text/css",
			"https://cdn.example.test/styles/theme.css",
		);
		expect(dependencies).toEqual([
			{ kind: "css_import", url: "https://cdn.example.test/styles/base.css" },
			{ kind: "css_url", url: "https://cdn.example.test/hero.webp" },
		]);
	});

	it("inventories static/dynamic modules, workers, service workers, and WASM", () => {
		const dependencies = discoverExternalDependencies(
			new TextEncoder().encode(`
				import "./static.js";
				export { value } from "https://modules.example/value.js";
				import("./dynamic.js");
				new Worker("./worker.js");
				new SharedWorker("./shared.js");
				navigator.serviceWorker.register("./service-worker.js");
				WebAssembly.instantiateStreaming(fetch("./module.wasm"));
				importScripts("./worker-dependency.js");
				new URL("./module-asset.js", import.meta.url);
				const runtimeScript = document.createElement("script");
				runtimeScript.src = "./runtime-script.js";
				const runtimeStyle = document.createElement("link");
				runtimeStyle.href = "./runtime-style.css";
				fetch("./runtime-data.json");
			`),
			"text/javascript",
			"https://cdn.example.test/app/entry.js",
		);
		expect(dependencies).toEqual(
			expect.arrayContaining([
				{ kind: "static_module_import", url: "https://cdn.example.test/app/static.js" },
				{ kind: "static_module_import", url: "https://modules.example/value.js" },
				{ kind: "dynamic_module_import", url: "https://cdn.example.test/app/dynamic.js" },
				{ kind: "worker", url: "https://cdn.example.test/app/worker.js" },
				{ kind: "worker", url: "https://cdn.example.test/app/shared.js" },
				{
					kind: "service_worker_attempt",
					url: "https://cdn.example.test/app/service-worker.js",
				},
				{ kind: "wasm", url: "https://cdn.example.test/app/module.wasm" },
				{
					kind: "worker_import",
					url: "https://cdn.example.test/app/worker-dependency.js",
				},
				{ kind: "module_url", url: "https://cdn.example.test/app/module-asset.js" },
				{
					kind: "runtime_script",
					url: "https://cdn.example.test/app/runtime-script.js",
				},
				{
					kind: "runtime_style",
					url: "https://cdn.example.test/app/runtime-style.css",
				},
				{
					kind: "runtime_fetch",
					url: "https://cdn.example.test/app/runtime-data.json",
				},
			]),
		);
	});

	it("inventories import-map targets and preserves their integrity metadata", () => {
		const dependencies = discoverExternalDependencies(
			new TextEncoder().encode(`
				<script type="importmap">{
					"imports": { "library": "https://modules.example/library.js" },
					"scopes": {
						"/feature/": { "helper": "./helper.js" }
					},
					"integrity": {
						"https://modules.example/library.js": "sha384-YWJj"
					}
				}</script>
			`),
			"text/javascript",
			"https://cdn.example.test/app/entry.js",
		);
		expect(dependencies).toEqual(
			expect.arrayContaining([
				{
					integrity: "sha384-YWJj",
					kind: "import_map_module",
					url: "https://modules.example/library.js",
				},
				{
					kind: "import_map_module",
					url: "https://cdn.example.test/app/helper.js",
				},
			]),
		);
	});

	it("rejects bare module specifiers because v0 does not install author import maps", () => {
		expect(() =>
			discoverExternalDependencies(
				new TextEncoder().encode('import "unmapped-package";'),
				"text/javascript",
				"https://cdn.example.test/app/entry.js",
			),
		).toThrow(/Custom Theme external resource/i);
	});

	it("bounds adversarial discovery memory while retaining an overflow sentinel", () => {
		const source = Array.from(
			{ length: MaximumCustomThemeDiscoveredGraphNodes * 4 },
			(_, index) => `import "./dependency-${index}.js";`,
		).join("\n");
		const dependencies = discoverExternalDependencies(
			new TextEncoder().encode(source),
			"text/javascript",
			"https://cdn.example.test/entry.js",
		);
		expect(dependencies).toHaveLength(MaximumCustomThemeDiscoveredGraphNodes + 1);
	});
});
