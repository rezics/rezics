import type {
	CustomThemeReferenceRenderRequestV0,
	CustomThemeReferenceRenderResultV0,
} from "@rezics/block";
import { describe, expect, it, vi } from "vitest";

import {
	buildCustomThemeReferenceRenderDocument,
	CustomThemeReferenceRenderPath,
	handleCustomThemeReferenceRenderRequest,
} from "./custom-theme-reference-render";

const RevisionId = "019f9000-0000-7000-8000-000000000002";
const Token = "renderer-secret-that-is-long-enough";

function requestBody(): CustomThemeReferenceRenderRequestV0 {
	return {
		revisionId: RevisionId,
		manifest: {
			schemaVersion: 0,
			targetContract: "rezics.unit.presentation@0",
			executionMode: "host_full_trust",
			resourceMode: "external_live",
			fragments: [],
			styles: [],
			scripts: [
				{
					source: { kind: "external", url: "https://cdn.example/classic.js" },
					role: "classic_dependency",
					order: 0,
					required: true,
				},
				{
					source: { kind: "external", url: "https://cdn.example/entry.js" },
					role: "module_entry",
					order: 1,
					required: true,
				},
			],
			declaredRuntimeOrigins: { connect: [], image: [], font: [], frame: [], media: [] },
		},
		packagedResources: [],
		headerMarkup: "<nav>Reviewed header</nav>",
		footerMarkup: "<small>Reviewed footer</small>",
		allowedOrigins: ["https://cdn.example"],
	};
}

function renderResult(): CustomThemeReferenceRenderResultV0 {
	const fixture = {
		viewport: "desktop-1440x900",
		colorScheme: "light" as const,
		screenshotBase64: "iVBORw0KGgo=",
		consoleErrorCount: 0,
		loadFailureCount: 0,
		layoutShift: 0,
		largestContentfulPaintMilliseconds: 10,
		interactionToNextPaintMilliseconds: 0,
		longTaskMilliseconds: 0,
		memoryBytes: 1,
		transferredBytes: 1,
		requestCount: 2,
	};
	return {
		rendererVersion: "test-renderer/1",
		observedRuntimeOrigins: { connect: [], image: [], font: [], frame: [], media: [] },
		fixtures: [fixture, { ...fixture, viewport: "mobile-390x844", colorScheme: "dark" }],
		accessibilityFindings: [],
		cleanupPassed: true,
	};
}

function environment() {
	return {
		BROWSER: {} as never,
		CUSTOM_THEME_REFERENCE_RENDER_TOKEN: Token,
	};
}

describe("Custom Theme reference renderer", () => {
	it("requires the internal bearer credential and validates the shared request contract", async () => {
		const unauthorized = await handleCustomThemeReferenceRenderRequest(
			new Request(`https://www.example.test${CustomThemeReferenceRenderPath}`, {
				method: "POST",
				body: JSON.stringify(requestBody()),
			}),
			environment(),
			vi.fn(),
		);
		expect(unauthorized.status).toBe(404);

		const invalid = await handleCustomThemeReferenceRenderRequest(
			new Request(`https://www.example.test${CustomThemeReferenceRenderPath}`, {
				method: "POST",
				headers: { authorization: `Bearer ${Token}` },
				body: JSON.stringify({ revisionId: RevisionId }),
			}),
			environment(),
			vi.fn(),
		);
		expect(invalid.status).toBe(400);
	});

	it("passes only parsed input to the isolated renderer", async () => {
		const render = vi.fn(async () => renderResult());
		const body = requestBody();
		const response = await handleCustomThemeReferenceRenderRequest(
			new Request(`https://www.example.test${CustomThemeReferenceRenderPath}`, {
				method: "POST",
				headers: { authorization: `Bearer ${Token}`, "content-type": "application/json" },
				body: JSON.stringify(body),
			}),
			environment(),
			render,
		);
		expect(response.status).toBe(200);
		expect(response.headers.get("cache-control")).toBe("private, no-store");
		expect(render).toHaveBeenCalledWith(body, environment());
	});

	it("builds deterministic executable order without allowing source URLs to break attributes", () => {
		const body = requestBody();
		body.manifest.scripts[0].source = {
			kind: "external",
			url: 'https://cdn.example/classic.js?quoted="&tag=<script>',
		};
		const document = buildCustomThemeReferenceRenderDocument(body);
		expect(document).toContain("quoted=&quot;&amp;tag=&lt;script&gt;");
		expect(document).not.toContain('quoted="&tag=<script>');
		expect(document.indexOf("classic.js")).toBeLessThan(document.indexOf('type="module"'));
		expect(document).toContain("</script>");
	});
});
