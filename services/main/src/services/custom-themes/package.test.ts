import { gzipSync } from "node:zlib";

import {
	MaximumCustomThemeInitialCodeBytes,
	MaximumCustomThemePackageBytes,
	type SubmittedCustomThemeManifestV0,
} from "@rezics/block";
import { describe, expect, it } from "vitest";

import { validateSubmittedCustomThemePackage, type SubmittedCustomThemeFileInput } from "./package";

function manifest(
	overrides: Partial<SubmittedCustomThemeManifestV0> = {},
): SubmittedCustomThemeManifestV0 {
	return {
		schemaVersion: 0,
		targetContract: "rezics.unit.presentation@0",
		executionMode: "host_full_trust",
		resourceMode: "external_live",
		fragments: [{ slot: "header.append", source: { kind: "packaged", path: "header.html" } }],
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
		...overrides,
	};
}

function file(
	path: string,
	role: SubmittedCustomThemeFileInput["role"],
	contentType: string,
	content: string,
): SubmittedCustomThemeFileInput {
	return { path, role, contentType, contentBase64: Buffer.from(content).toString("base64") };
}

function input(manifestDocument = manifest()) {
	return {
		manifest: manifestDocument,
		files: [
			file("header.html", "html", "text/html", "<p>Reviewed header</p>"),
			file("theme.css", "css", "text/css", "body { color: CanvasText; }"),
			file("entry.js", "js", "text/javascript", "export function mount() {}"),
		],
		sourceArchive: {
			contentType: "application/gzip",
			contentBase64: gzipSync("review source").toString("base64"),
		},
	};
}

describe("Custom Theme package validation", () => {
	it("accepts one immutable, manifest-managed module package", () => {
		const validated = validateSubmittedCustomThemePackage(input());
		expect(validated.manifest.resourceMode).toBe("external_live");
		expect(validated.files.map(({ role }) => role)).toEqual([
			"html",
			"css",
			"js",
			"manifest",
			"source_archive",
		]);
		expect(validated.manifestSha256).toMatch(/^[0-9a-f]{64}$/);
	});

	it("requires the module entry to be required and last", () => {
		expect(() =>
			validateSubmittedCustomThemePackage(
				input(
					manifest({
						scripts: [
							{
								source: { kind: "packaged", path: "entry.js" },
								role: "module_entry",
								order: 0,
								required: false,
							},
						],
					}),
				),
			),
		).toThrow("Custom Theme package is invalid");
	});

	it.each([
		"<script src='https://example.test/code.js'></script>",
		"<button onclick='mount()'>Run</button>",
		"<a href='javascript:mount()'>Run</a>",
		"<style>body { display: none }</style>",
	])("rejects executable fragment content outside the manifest: %s", (markup) => {
		const candidate = input();
		candidate.files[0] = file("header.html", "html", "text/html", markup);
		expect(() => validateSubmittedCustomThemePackage(candidate)).toThrow(
			"Custom Theme package is invalid",
		);
	});

	it("requires every direct external resource to have SRI or an explicit waiver", () => {
		const candidate = input(
			manifest({
				styles: [
					{
						source: { kind: "external", url: "https://cdn.example.test/theme.css" },
						required: true,
					},
				],
			}),
		);
		expect(() => validateSubmittedCustomThemePackage(candidate)).toThrow(
			"Custom Theme package is invalid",
		);
	});

	it("rejects unsafe external URL syntax and empty waivers at submission", () => {
		const candidate = input();
		for (const url of [
			"http://cdn.example.test/theme.css",
			"https://user:secret@cdn.example.test/theme.css",
			"https://cdn.example.test:8443/theme.css",
			"https://cdn.example.test/theme.css#mutable",
		])
			expect(() =>
				validateSubmittedCustomThemePackage({
					...candidate,
					manifest: {
						...candidate.manifest,
						styles: [
							{
								required: true,
								source: {
									kind: "external",
									url,
									integrityWaiverReason: "Reviewed mutable resource",
								},
							},
						],
					},
				}),
			).toThrow(/package is invalid/i);
		expect(() =>
			validateSubmittedCustomThemePackage({
				...candidate,
				manifest: {
					...candidate.manifest,
					styles: [
						{
							required: true,
							source: {
								kind: "external",
								url: "https://cdn.example.test/theme.css",
								integrityWaiverReason: "   ",
							},
						},
					],
				},
			}),
		).toThrow(/package is invalid/i);
	});

	it("accepts only exact HTTPS origins in the runtime inventory", () => {
		const candidate = input();
		candidate.manifest = manifest({
			declaredRuntimeOrigins: {
				...candidate.manifest.declaredRuntimeOrigins,
				connect: ["https://api.example.test/path"],
			},
		});
		expect(() => validateSubmittedCustomThemePackage(candidate)).toThrow(
			"Custom Theme package is invalid",
		);
	});

	it("rejects packages whose decoded files exceed the bounded review envelope", () => {
		const contentBase64 = Buffer.alloc(MaximumCustomThemeInitialCodeBytes).toString("base64");
		const candidate = input();
		candidate.files = Array.from(
			{
				length: Math.floor(MaximumCustomThemePackageBytes / MaximumCustomThemeInitialCodeBytes) + 1,
			},
			(_, index) => ({
				path: `asset-${index}.bin`,
				role: "asset" as const,
				contentType: "application/octet-stream",
				contentBase64,
			}),
		);
		expect(() => validateSubmittedCustomThemePackage(candidate)).toThrow(
			"Custom Theme package is invalid",
		);
	});
});
