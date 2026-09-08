import { describe, expect, it } from "vitest";
import { compatibleMergeIdentities, mergeFingerprint } from "./manifest";
import { DefaultMergePlan } from "./contracts";
const source = {
	reference: { owner: "publishing" as const, id: "00000000-0000-4000-8000-000000000001" },
	shape: "work",
	status: "published" as const,
	visibility: "public" as const,
	contentRating: "general" as const,
	moderationStatus: "approved" as const,
};
describe("native merge compatibility", () => {
	it("requires the exact owner, shape and visibility boundary", () => {
		expect(compatibleMergeIdentities(source, source)).toBe(true);
		expect(compatibleMergeIdentities(source, { ...source, shape: "publication" })).toBe(false);
		expect(compatibleMergeIdentities(source, { ...source, visibility: "private" })).toBe(false);
		expect(compatibleMergeIdentities(source, { ...source, status: "archived" })).toBe(false);
	});
	it("fingerprints each pinned identity revision and reconciliation decision", () => {
		const manifest = {
			owner: "publishing" as const,
			shape: "work",
			sourceUnit: { id: source.reference.id, title: null },
			targetUnit: { id: "00000000-0000-4000-8000-000000000002", title: null },
			sourceRevision: 1,
			targetRevision: 2,
			sourceUpdatedAt: "2026-09-08T00:00:00.000Z",
			targetUpdatedAt: "2026-09-08T00:00:00.000Z",
			status: "published" as const,
			visibility: "public" as const,
			plan: DefaultMergePlan,
		};
		expect(mergeFingerprint(manifest)).not.toBe(
			mergeFingerprint({ ...manifest, targetRevision: 3 }),
		);
		expect(mergeFingerprint(manifest)).not.toBe(
			mergeFingerprint({ ...manifest, plan: { ...DefaultMergePlan, names: "retain_source" } }),
		);
	});
});
