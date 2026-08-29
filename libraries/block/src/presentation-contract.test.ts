import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";

import {
	SubmittedCustomThemeManifestV0,
	UnitPresentationDocumentV0,
} from "./presentation-contract";

const submittedManifest = {
	schemaVersion: 0,
	targetContract: "rezics.unit.presentation@0",
	executionMode: "host_full_trust",
	resourceMode: "external_live",
	fragments: [],
	styles: [],
	scripts: [],
	declaredRuntimeOrigins: { connect: [], image: [], font: [], frame: [], media: [] },
} as const;

describe("Custom Theme v0 presentation contracts", () => {
	it("accepts only the implemented external-live mode and target", () => {
		expect(Value.Check(SubmittedCustomThemeManifestV0, submittedManifest)).toBe(true);
		expect(
			Value.Check(SubmittedCustomThemeManifestV0, {
				...submittedManifest,
				resourceMode: "self_hosted",
			}),
		).toBe(false);
		expect(
			Value.Check(SubmittedCustomThemeManifestV0, {
				...submittedManifest,
				targetContract: "rezics.unit.presentation@1",
			}),
		).toBe(false);
	});

	it("keeps the manifest and semantic presentation slots closed", () => {
		expect(
			Value.Check(SubmittedCustomThemeManifestV0, {
				...submittedManifest,
				reservedMode: "future",
			}),
		).toBe(false);
		expect(
			Value.Check(SubmittedCustomThemeManifestV0, {
				...submittedManifest,
				fragments: [{ slot: "main.replace", source: { kind: "packaged", path: "main.html" } }],
			}),
		).toBe(false);
		expect(
			Value.Check(UnitPresentationDocumentV0, {
				_type: "unit-presentation-document",
				_key: "000000000001",
				header: { _type: "block-document", _key: "000000000002", blocks: [] },
				footer: { _type: "block-document", _key: "000000000003", blocks: [] },
			}),
		).toBe(true);
	});
});
