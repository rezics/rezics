import type {
	CustomThemeReferenceRenderResultV0,
	SubmittedCustomThemeManifestV0,
} from "@rezics/block";
import { describe, expect, it, vi } from "vitest";

import {
	generateCustomThemeReferenceRenderEvidence,
	type ReferenceRenderDependencies,
} from "./reference-render";

const ThemeUnitId = "019f9000-0000-7000-8000-000000000001";
const RevisionId = "019f9000-0000-7000-8000-000000000002";
const ScreenshotIds = [
	"019f9000-0000-7000-8000-000000000003",
	"019f9000-0000-7000-8000-000000000004",
] as const;

const manifest: SubmittedCustomThemeManifestV0 = {
	schemaVersion: 0,
	targetContract: "rezics.unit.presentation@0",
	executionMode: "host_full_trust",
	resourceMode: "external_live",
	fragments: [],
	styles: [],
	scripts: [
		{
			source: {
				kind: "external",
				url: "https://cdn.example.test/entry.js",
				integrityWaiverReason: "Reviewed mutable preview resource",
			},
			role: "module_entry",
			order: 0,
			required: true,
		},
	],
	declaredRuntimeOrigins: { connect: [], image: [], font: [], frame: [], media: [] },
};

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
		requestCount: 1,
	};
	return {
		rendererVersion: "test-renderer/1",
		observedRuntimeOrigins: { connect: [], image: [], font: [], frame: [], media: [] },
		fixtures: [fixture, { ...fixture, viewport: "mobile-390x844", colorScheme: "dark" }],
		accessibilityFindings: [],
		cleanupPassed: true,
	};
}

function dependencies(overrides: Partial<ReferenceRenderDependencies> = {}) {
	let idIndex = 0;
	const fetcher = async (_input: string | URL | Request, init?: RequestInit) => {
		expect(new Headers(init?.headers).get("authorization")).toBe("Bearer test-renderer-token");
		return Response.json(renderResult());
	};
	return {
		delete: vi.fn(async () => ({}) as never),
		fetch: fetcher,
		presignGet: vi.fn(async () => "https://objects.example.test/signed-object"),
		put: vi.fn(async () => ({}) as never),
		randomUuid: () => ScreenshotIds[idIndex++] ?? ScreenshotIds[1],
		rendererToken: "test-renderer-token",
		rendererUrl: "https://www.example.test/__internal/custom-theme-reference-render",
		...overrides,
	} satisfies ReferenceRenderDependencies;
}

describe("server-attested Custom Theme reference renders", () => {
	it("validates PNG screenshots and stores immutable artifact evidence", async () => {
		const injected = dependencies();
		const result = await generateCustomThemeReferenceRenderEvidence(
			{
				themeUnitId: ThemeUnitId,
				revisionId: RevisionId,
				manifest,
				files: [],
				reviewedUrls: ["https://cdn.example.test/entry.js"],
			},
			injected,
		);
		expect(result.evidence.fixtures.map(({ screenshotAssetId }) => screenshotAssetId)).toEqual(
			ScreenshotIds,
		);
		expect(result.artifacts).toHaveLength(2);
		expect(injected.put).toHaveBeenCalledTimes(2);
	});

	it("removes all attempted artifacts when an object write fails partway", async () => {
		const put = vi
			.fn<ReferenceRenderDependencies["put"]>()
			.mockResolvedValueOnce({} as never)
			.mockRejectedValueOnce(new Error("storage unavailable"));
		const remove = vi.fn(async () => ({}) as never);
		const injected = dependencies({ put, delete: remove });
		await expect(
			generateCustomThemeReferenceRenderEvidence(
				{
					themeUnitId: ThemeUnitId,
					revisionId: RevisionId,
					manifest,
					files: [],
					reviewedUrls: ["https://cdn.example.test/entry.js"],
				},
				injected,
			),
		).rejects.toThrow("storage unavailable");
		expect(remove).toHaveBeenCalledTimes(2);
	});
});
