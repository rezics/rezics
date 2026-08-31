import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

import type { SubmittedCustomThemeManifestV0 } from "@rezics/block";

const LocalRendererVersion = "local-disposable-demo";
const LocalScreenshotIds = [
	"019b76da-a800-7aa0-8000-00000000d001",
	"019b76da-a800-7aa0-8000-00000000d002",
] as const;

export function localLightNovelDemoReviewEvidence() {
	return {
		automatedStatus: "passed" as const,
		reviewedAt: new Date().toISOString(),
		targetContract: "rezics.unit.presentation@0",
		resourceMode: "external_live",
		directResourceCount: 0,
		graphNodeCount: 0,
		packageFileCount: 2,
		licenseSignals: [],
		licenseSignalsTruncated: false,
		failure: null,
		declaredRuntimeOrigins: {
			connect: [],
			image: [],
			font: [],
			frame: [],
			media: [],
		},
		limitations: [
			"Local disposable development install. Automated browser review is not run.",
		],
		humanReview: {
			owner: "REZICS Editorial (local disposable install)",
			incidentContact: "REZICS Moderation (local disposable install)",
			licenseFindings: [
				"Packaged CSS and JS are original demo sources. Live2D is omitted unless a separately licensed payload is added later.",
			],
			acknowledgedRisks: [
				"host_full_trust executes with first-party privilege for development-preview viewers",
			],
		},
		referenceRender: {
			rendererVersion: LocalRendererVersion,
			observedRuntimeOrigins: {
				connect: [],
				image: [],
				font: [],
				frame: [],
				media: [],
			},
			fixtures: [
				{
					viewport: "desktop",
					colorScheme: "light" as const,
					screenshotAssetId: LocalScreenshotIds[0],
					consoleErrorCount: 0,
					loadFailureCount: 0,
					layoutShift: 0,
					largestContentfulPaintMilliseconds: 0,
					interactionToNextPaintMilliseconds: 0,
					longTaskMilliseconds: 0,
					memoryBytes: 0,
					transferredBytes: 0,
					requestCount: 0,
				},
				{
					viewport: "desktop",
					colorScheme: "dark" as const,
					screenshotAssetId: LocalScreenshotIds[1],
					consoleErrorCount: 0,
					loadFailureCount: 0,
					layoutShift: 0,
					largestContentfulPaintMilliseconds: 0,
					interactionToNextPaintMilliseconds: 0,
					longTaskMilliseconds: 0,
					memoryBytes: 0,
					transferredBytes: 0,
					requestCount: 0,
				},
			],
			accessibilityFindings: [],
			cleanupPassed: true,
		},
	};
}

export function buildLightNovelDemoThemePackageFromContents(input: {
	readonly css: Buffer;
	readonly js: Buffer;
}) {
	const sourceArchive = gzipSync(
		Buffer.concat([
			Buffer.from("theme.css\n"),
			input.css,
			Buffer.from("\nentry.js\n"),
			input.js,
		]),
	);
	const manifest = {
		schemaVersion: 0,
		targetContract: "rezics.unit.presentation@0",
		executionMode: "host_full_trust",
		resourceMode: "external_live",
		fragments: [],
		styles: [{ source: { kind: "packaged", path: "theme.css" }, required: true }],
		scripts: [
			{
				source: { kind: "packaged", path: "entry.js" },
				role: "module_entry",
				order: 0,
				required: true,
			},
		],
		declaredRuntimeOrigins: { connect: [], image: [], font: [], frame: [], media: [] },
	} satisfies SubmittedCustomThemeManifestV0;
	return {
		manifest,
		files: [
			{
				path: "theme.css",
				role: "css" as const,
				contentType: "text/css",
				contentBase64: input.css.toString("base64"),
			},
			{
				path: "entry.js",
				role: "js" as const,
				contentType: "text/javascript",
				contentBase64: input.js.toString("base64"),
			},
		],
		sourceArchive: {
			contentType: "application/gzip" as const,
			contentBase64: sourceArchive.toString("base64"),
		},
	};
}

export async function buildLightNovelDemoThemePackage(themeDir: string) {
	return buildLightNovelDemoThemePackageFromContents({
		css: await readFile(join(themeDir, "theme.css")),
		js: await readFile(join(themeDir, "entry.js")),
	});
}
