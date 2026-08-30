import { describe, expect, it } from "vitest";

import { ContentLabelRegistryIds } from "../../bootstrap/data/content-labels";
import {
	isUnitMergeManifestStaleness,
	planUnitMergeGraph,
	requireUnitMergeRegistryEligibility,
} from "./manifest";

const sourceUnitId = "0195c49b-8f3b-7e18-8c45-c2f36ee8d337";
const targetUnitId = "0195c49b-8f3b-7e18-8c45-c2f36ee8d338";
const otherMainUnitId = "0195c49b-8f3b-7e18-8c45-c2f36ee8d339";

describe("Unit merge manifest failure classification", () => {
	it.each([
		"UnitMergeManifestStale",
		"UnitMergeRequestConflict",
		"UnitNotFound",
		"UnitMergeKindMismatch",
		"UnitMergeKindIneligible",
	])("classifies serialized %s failures as stale", (type) => {
		expect(isUnitMergeManifestStaleness({ type })).toBe(true);
	});

	it("does not classify unrelated serialized failures as stale", () => {
		expect(isUnitMergeManifestStaleness({ type: "InternalError" })).toBe(false);
		expect(isUnitMergeManifestStaleness(new Error("transient"))).toBe(false);
	});
});

describe("Unit merge protected registry policy", () => {
	it.each(ContentLabelRegistryIds)(
		"rejects registry Unit %s as the merge source with the typed eligibility error",
		(registryUnitId) => {
			expect(() =>
				requireUnitMergeRegistryEligibility({
					sourceUnitId: registryUnitId,
					targetUnitId,
				}),
			).toThrowError(expect.objectContaining({ type: "ContentLabelUnitMergeForbidden" }));
		},
	);

	it.each(ContentLabelRegistryIds)(
		"rejects registry Unit %s as the merge target with the typed eligibility error",
		(registryUnitId) => {
			expect(() =>
				requireUnitMergeRegistryEligibility({
					sourceUnitId,
					targetUnitId: registryUnitId,
				}),
			).toThrowError(expect.objectContaining({ type: "ContentLabelUnitMergeForbidden" }));
		},
	);

	it("admits ordinary Unit IDs to the remaining manifest checks", () => {
		expect(() => requireUnitMergeRegistryEligibility({ sourceUnitId, targetUnitId })).not.toThrow();
	});
});

describe("Unit merge Variant graph planning", () => {
	it("does not mutate the graph for a standalone source", () => {
		expect(
			planUnitMergeGraph({
				sourceUnitId,
				targetUnitId,
				source: { role: "standalone", mainUnitId: null },
				target: { role: "variant", mainUnitId: otherMainUnitId },
			}),
		).toMatchObject({ action: "none", destinationMainUnitId: null });
	});

	it("detaches a source Variant regardless of the target role", () => {
		expect(
			planUnitMergeGraph({
				sourceUnitId,
				targetUnitId,
				source: { role: "variant", mainUnitId: otherMainUnitId },
				target: { role: "main", mainUnitId: null },
			}),
		).toMatchObject({ action: "detach_source", destinationMainUnitId: null });
	});

	it("promotes a target Variant that belongs to the source Main", () => {
		expect(
			planUnitMergeGraph({
				sourceUnitId,
				targetUnitId,
				source: { role: "main", mainUnitId: null },
				target: { role: "variant", mainUnitId: sourceUnitId },
			}),
		).toMatchObject({
			action: "promote_target_from_source",
			destinationMainUnitId: targetUnitId,
		});
	});

	it("moves source Variants under an unrelated target Variant's Main", () => {
		expect(
			planUnitMergeGraph({
				sourceUnitId,
				targetUnitId,
				source: { role: "main", mainUnitId: null },
				target: { role: "variant", mainUnitId: otherMainUnitId },
			}),
		).toMatchObject({
			action: "reparent_source_variants_to_target_main",
			destinationMainUnitId: otherMainUnitId,
		});
	});

	it("moves source Variants directly under a standalone target", () => {
		expect(
			planUnitMergeGraph({
				sourceUnitId,
				targetUnitId,
				source: { role: "main", mainUnitId: null },
				target: { role: "standalone", mainUnitId: null },
			}),
		).toMatchObject({
			action: "reparent_source_variants_to_target",
			destinationMainUnitId: targetUnitId,
		});
	});
});
