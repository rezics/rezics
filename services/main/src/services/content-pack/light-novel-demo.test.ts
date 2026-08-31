import { describe, expect, it } from "vitest";

import {
	customThemeHumanReviewEvidenceIsComplete,
	customThemeObservedRuntimeOriginsAreCovered,
	customThemeReferenceRenderEvidenceIsComplete,
} from "../custom-themes/service";
import { validateSubmittedCustomThemePackage } from "../custom-themes/package";
import { assertLocalDatabaseUrl } from "../seed/data";
import {
	buildLightNovelDemoThemePackageFromContents,
	localLightNovelDemoReviewEvidence,
} from "./light-novel-demo-package";

describe("local light-novel demo install", () => {
	it("refuses non-loopback database URLs", () => {
		expect(() => assertLocalDatabaseUrl("postgresql://rezics@db.example.test:5432/rezics")).toThrow(
			/non-local database host/,
		);
		expect(() => assertLocalDatabaseUrl("postgresql://rezics@127.0.0.1:5432/rezics")).not.toThrow();
	});

	it("records local review evidence that the installer can treat as passed", () => {
		const evidence = localLightNovelDemoReviewEvidence();
		expect(evidence.automatedStatus).toBe("passed");
		expect(customThemeHumanReviewEvidenceIsComplete(evidence.humanReview)).toBe(true);
		expect(customThemeReferenceRenderEvidenceIsComplete(evidence.referenceRender)).toBe(true);
		expect(
			customThemeObservedRuntimeOriginsAreCovered(
				{
					schemaVersion: 0,
					targetContract: "rezics.unit.presentation@0",
					executionMode: "host_full_trust",
					resourceMode: "external_live",
					fragments: [],
					styles: [],
					scripts: [],
					declaredRuntimeOrigins: { connect: [], image: [], font: [], frame: [], media: [] },
				},
				evidence.referenceRender,
			),
		).toBe(true);
	});

	it("packages the local CSS and module entry", () => {
		const pack = buildLightNovelDemoThemePackageFromContents({
			css: Buffer.from("[data-zone-appearance-content] { background: transparent; }"),
			js: Buffer.from("export function mount() { return () => undefined; }"),
		});
		const validated = validateSubmittedCustomThemePackage(pack);
		expect(validated.manifest.executionMode).toBe("host_full_trust");
		expect(validated.files.map(({ path }) => path)).toEqual([
			"theme.css",
			"entry.js",
			"rezics-theme-manifest.json",
			"source-archive",
		]);
	});
});
