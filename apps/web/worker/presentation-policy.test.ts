import { describe, expect, it, vi } from "vitest";

import {
	contentSecurityPolicy,
	handlePresentationPolicyProbeRequest,
	isDocumentRequest,
	parsePresentationPolicy,
	resolvePresentationPolicyForRequest,
} from "./presentation-policy";

const ZoneId = "019f9000-0000-7000-8000-000000000001";
const RevisionId = "019f9000-0000-7000-8000-000000000002";
const Environment = { REZICS_API_ORIGIN: "https://api.example.test" };

function policy(overrides: Record<string, unknown> = {}) {
	return {
		revisionId: RevisionId,
		scriptOrigins: ["https://scripts.example"],
		styleOrigins: ["https://styles.example"],
		connectOrigins: ["https://api.theme.example"],
		imageOrigins: [],
		fontOrigins: [],
		frameOrigins: [],
		mediaOrigins: [],
		...overrides,
	};
}

describe("presentation request policy", () => {
	it("recognizes document requests but excludes prefetches", () => {
		expect(
			isDocumentRequest(
				new Request(`https://www.example.test/zone/${ZoneId}`, {
					headers: { accept: "text/html" },
				}),
			),
		).toBe(true);
		expect(
			isDocumentRequest(
				new Request(`https://www.example.test/zone/${ZoneId}`, {
					headers: { accept: "text/html", purpose: "prefetch" },
				}),
			),
		).toBe(false);
	});

	it("accepts only exact HTTPS origins and the two controlled blob lists", () => {
		expect(parsePresentationPolicy(policy())).toMatchObject({ revisionId: RevisionId });
		expect(
			parsePresentationPolicy(policy({ scriptOrigins: ["https://scripts.example; object-src *"] })),
		).toBeUndefined();
		expect(parsePresentationPolicy(policy({ connectOrigins: ["blob:"] }))).toBeUndefined();
		expect(parsePresentationPolicy(policy({ revisionId: null }))).toBeUndefined();
	});

	it("adds only parsed presentation origins to the document policy", () => {
		const parsed = parsePresentationPolicy(
			policy({
				frameOrigins: ["https://frames.example"],
				scriptOrigins: ["blob:", "https://scripts.example"],
			}),
		);
		if (!parsed) throw new Error("fixture policy did not parse");
		const csp = contentSecurityPolicy({
			development: false,
			fontAwesomeCssUrl: "https://fa.example/assets/fontawesome.css",
			nonce: "nonce-value",
			policy: parsed,
			secureRequest: true,
		});
		expect(csp).toContain("script-src 'self' 'nonce-nonce-value' 'wasm-unsafe-eval'");
		expect(csp).toContain("https://scripts.example");
		expect(csp).toContain("style-src 'self' 'nonce-nonce-value'");
		expect(csp).toContain("object-src 'none'");
		expect(csp).toContain("frame-src https://challenges.cloudflare.com https://frames.example");
		expect(csp).toContain("report-to rezics-csp");
		expect(csp).toContain("report-uri /__rezics/security-report");
		expect(csp).toContain("upgrade-insecure-requests");
		expect(csp).not.toContain(" 'unsafe-eval'");
	});

	it("resolves an exact Zone host with the viewer cookie and fails closed in safe mode", async () => {
		const fetcher = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
			expect(new Headers(init?.headers).get("cookie")).toBe("session=viewer");
			return Response.json(policy());
		});
		const request = new Request(`https://www.example.test/zone/${ZoneId}`, {
			headers: { accept: "text/html", cookie: "session=viewer" },
		});
		await expect(
			resolvePresentationPolicyForRequest(request, Environment, fetcher),
		).resolves.toMatchObject({
			revisionId: RevisionId,
		});
		expect(String(fetcher.mock.calls[0]?.[0])).toBe(
			`https://api.example.test/api/v1/units/by-id/${ZoneId}/presentation-policy?safeMode=false`,
		);

		fetcher.mockClear();
		await expect(
			resolvePresentationPolicyForRequest(
				new Request(`https://www.example.test/zone/${ZoneId}?rezics-safe-theme=1`, {
					headers: { accept: "text/html" },
				}),
				Environment,
				fetcher,
			),
		).resolves.toMatchObject({ revisionId: null });
		expect(fetcher).not.toHaveBeenCalled();
	});

	it("rechecks an open document without returning its resource origins", async () => {
		const fetcher = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
			expect(new Headers(init?.headers).get("cookie")).toBe("session=viewer");
			return Response.json(policy());
		});
		const response = await handlePresentationPolicyProbeRequest(
			new Request(`https://www.example.test/__rezics/presentation-policy?hostUnitId=${ZoneId}`, {
				headers: { cookie: "session=viewer" },
			}),
			Environment,
			fetcher,
		);
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ revisionId: RevisionId });
		expect(response.headers.get("cache-control")).toBe("private, no-store");
	});

	it("rejects ambiguous policy probes and fails closed when the backend is unavailable", async () => {
		const invalid = await handlePresentationPolicyProbeRequest(
			new Request(
				`https://www.example.test/__rezics/presentation-policy?hostUnitId=${ZoneId}&extra=true`,
			),
			Environment,
			vi.fn(),
		);
		expect(invalid.status).toBe(400);

		const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
		const unavailable = await handlePresentationPolicyProbeRequest(
			new Request(`https://www.example.test/__rezics/presentation-policy?hostUnitId=${ZoneId}`),
			Environment,
			vi.fn(async () => new Response(null, { status: 503 })),
		);
		expect(unavailable.status).toBe(503);
		expect(await unavailable.json()).toEqual({ revisionId: null });
		expect(error).toHaveBeenCalledOnce();
	});
});
