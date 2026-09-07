import { describe, expect, it } from "vitest";
import {
	planVndbSemantics,
	VndbHierarchyEdgeSchema,
	VndbSemanticObjectSchema,
	VndbSemanticRelations,
} from "./vndb-semantics-contracts";

describe("VNDB native semantic projections", () => {
	it("preserves relationship direction and scoped source claims", () => {
		const plan = planVndbSemantics({
			id: "v1",
			relations: [
				{ id: "v2", relation: "seq", relation_official: false },
				{ id: "v3", relation: "par", relation_official: true },
			],
		});
		expect(plan.relations.map((r) => r.key)).toEqual(["has-sequel", "has-parent-story"]);
		expect(plan.relations[0]?.qualifiers).toContainEqual({
			namespace: "source.vndb.qualifier",
			key: "claimed-official",
			kind: "boolean",
			value: false,
			path: "/relations/0/relation_official",
		});
		expect(Object.keys(VndbSemanticRelations.vn)).toHaveLength(10);
		expect(Object.keys(VndbSemanticRelations.producer)).toHaveLength(8);
		expect(() =>
			planVndbSemantics({ id: "v1", relations: [{ id: "p1", relation: "seq" }] }),
		).toThrow();
		expect(() =>
			planVndbSemantics({ id: "v1", relations: [{ id: "v2", relation: "new" }] }),
		).toThrow();
	});
	it("preserves two appearances of one character in different releases", () => {
		const plan = planVndbSemantics({
			id: "c1",
			vns: [
				{ id: "v1", role: "main", spoiler: 0, release: { id: "r1" } },
				{ id: "v1", role: "side", spoiler: 2, release: { id: "r2" } },
			],
		});
		expect(
			plan.relations.map(
				(r) => r.participants.find((p) => p.role === "release")?.target.externalId,
			),
		).toEqual(["r1", "r2"]);
		expect(plan.relations.map((r) => r.spoiler)).toEqual([0, 2]);
		expect(plan.relations[1]?.qualifiers.find((q) => q.key === "character-role")?.value).toBe(
			"supporting-character",
		);
	});
	it("does not convert unknown spoiler levels or known lies into unconditional facts", () => {
		const plan = planVndbSemantics({ id: "v1", tags: [{ id: "g1", rating: 2.1, lie: true }] });
		const tag = plan.relations[0];
		expect(tag?.spoiler).toBe(2);
		expect(tag?.qualifiers.find((q) => q.key === "spoiler-level")?.value).toBeNull();
		expect(tag?.qualifiers.find((q) => q.key === "known-false")?.value).toBe(true);
		expect(tag?.qualifiers.find((q) => q.key === "tag-rating")?.namespace).toBe(
			"source.vndb.statistics",
		);
		expect(plan.facts).toEqual([]);
	});
	it("keeps the same image's release, VN and language context together", () => {
		const plan = planVndbSemantics({
			id: "r1",
			images: [
				{
					id: "cv1",
					type: "pkgfront",
					photo: true,
					vn: "v2",
					languages: ["ja", "en"],
					url: "https://img.vndb.org/cv/1.jpg",
					dims: [640, 480],
					sexual: 0.5,
					violence: 1,
					votecount: 3,
				},
			],
		});
		expect(plan.relations).toHaveLength(2);
		expect(
			plan.relations.map((r) => r.qualifiers.find((q) => q.key === "image-source-language")?.value),
		).toEqual(["ja", "en"]);
		for (const relation of plan.relations) {
			expect(relation.participants.find((p) => p.role === "content")?.target).toMatchObject({
				externalId: "v2",
				path: "/images/0/vn",
			});
			expect(relation.qualifiers.find((q) => q.key === "image-sexual")?.value).toBe(0.5);
			expect(relation.qualifiers.find((q) => q.key === "image-dims-width")?.value).toBe(640);
		}
	});
	it("does not merge redundant external sites or rewrite source URLs", () => {
		const plan = planVndbSemantics({
			id: "r1",
			extlinks: [
				{ url: "https://store.steampowered.com/app/702050/", name: "steam", id: 702050 },
				{ url: "https://steamdb.info/app/702050/", name: "steamdb", id: "702050" },
			],
		});
		expect(plan.relations).toHaveLength(2);
		expect(plan.relations.map((r) => r.qualifiers.find((q) => q.key === "url")?.value)).toEqual([
			"https://store.steampowered.com/app/702050/",
			"https://steamdb.info/app/702050/",
		]);
		expect(() =>
			planVndbSemantics({ id: "r1", extlinks: [{ url: "javascript:alert(1)" }] }),
		).toThrow();
	});
	it("leaves source-only cached statistics in the archive", () => {
		const plan = planVndbSemantics({
			id: "v1",
			average: null,
			rating: 71.2,
			votecount: 0,
			length_minutes: null,
		});
		expect(plan.facts).toEqual([]);
	});
	it("validates DAG edges without forcing a single parent or inferring ancestors", () => {
		expect(VndbHierarchyEdgeSchema.parse({ id: "g1", parent: "g2", main: true }).parent).toBe("g2");
		expect(VndbHierarchyEdgeSchema.parse({ id: "g1", parent: "g3", main: false }).parent).toBe(
			"g3",
		);
		expect(() => VndbHierarchyEdgeSchema.parse({ id: "g1", parent: "g1", main: false })).toThrow();
		expect(() => VndbHierarchyEdgeSchema.parse({ id: "g1", parent: "i1", main: false })).toThrow();
	});
	it("accepts source-free meanings for quotes, engines and DRM flags", () => {
		expect(
			VndbSemanticObjectSchema.parse({
				objectType: "quote",
				id: "q1",
				quote: "A test fixture",
				score: -1,
				vn: { id: "v1" },
				character: null,
			}).objectType,
		).toBe("quote");
		expect(
			VndbSemanticObjectSchema.parse({ objectType: "engine", id: 1, name: "Fixture engine" }).id,
		).toBe(1);
		expect(() =>
			VndbSemanticObjectSchema.parse({ objectType: "drm", id: 1, name: "Incomplete mechanism" }),
		).toThrow();
	});
	it("bounds each supplied collection and rejects unknown source relationship codes", () => {
		expect(() =>
			planVndbSemantics({ id: "v1", tags: Array.from({ length: 513 }, () => ({ id: "g1" })) }),
		).toThrow();
		expect(() =>
			planVndbSemantics({ id: "v1", relations: [{ id: "v2", relation: "unreviewed" }] }),
		).toThrow();
	});
});
