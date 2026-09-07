import { describe, expect, it } from "vitest";
import { mergeVndbOwnedValues } from "./vndb-release-update";
import { vndbSemanticKeys, vndbSemanticSupportId } from "./vndb-semantics";
import { planVndbSemantics } from "./vndb-semantics-contracts";
import { planVndbDumpRelease, planVndbDumpReleaseSemantics } from "./vndb-dump";
import { vndbReleaseComponentId } from "./vndb-release";
import { planVndbNativeNames } from "./vndb-names-update";

describe("VNDB native source deltas", () => {
	it("separates semantic evidence for identical bytes under different native correspondence epochs", () => {
		const document = {
			record: { id: "00000000-0000-4000-8000-000000000001" },
			snapshot: { id: "00000000-0000-4000-8000-000000000002" },
		};
		const scope = { mappingKey: "00000000-0000-4000-8000-000000000003", correspondenceRevision: 1 };
		const original = vndbSemanticSupportId(document, "fact/example/0", scope);
		expect(original).toBe(vndbSemanticSupportId(document, "fact/example/0", { ...scope }));
		expect(original).not.toBe(
			vndbSemanticSupportId(document, "fact/example/0", { ...scope, correspondenceRevision: 4 }),
		);
	});
	it("changes only source-modified fields and rejects local conflicts", () => {
		expect(
			mergeVndbOwnedValues(
				{ notes: "old", catalog: null },
				{ notes: "new", catalog: null },
				{ notes: "old", catalog: "LOCAL" },
			),
		).toEqual({ notes: "new", catalog: "LOCAL" });
		expect(() =>
			mergeVndbOwnedValues({ notes: "old" }, { notes: "new" }, { notes: "LOCAL" }),
		).toThrow(/conflicts/);
		expect(mergeVndbOwnedValues({ notes: "old" }, { notes: "new" }, { notes: "new" })).toEqual({
			notes: "new",
		});
	});
	it("keeps relation identity across array reordering and mutable qualifier changes", () => {
		const before = planVndbSemantics({
			id: "v1",
			tags: [
				{ id: "g1", rating: 1, spoiler: 0, lie: false },
				{ id: "g2", rating: 2, spoiler: 0, lie: false },
			],
		});
		const after = planVndbSemantics({
			id: "v1",
			tags: [
				{ id: "g2", rating: 3, spoiler: 1, lie: false },
				{ id: "g1", rating: 2, spoiler: 0, lie: false },
			],
		});
		const a = vndbSemanticKeys(before),
			b = vndbSemanticKeys(after);
		expect(a.relations[0]).toBe(b.relations[1]);
		expect(a.relations[1]).toBe(b.relations[0]);
		expect(a.qualifiers[0]?.[0]).toBe(b.qualifiers[1]?.[0]);
	});
	it("keeps user-reported playtime estimates qualified and primary language independent of names", () => {
		const estimate = planVndbSemantics({
			id: "v1",
			length_minutes: 120,
			length_votes: 10,
			length: 2,
		});
		expect(estimate.relations[0]).toMatchObject({
			key: "reported-playtime-estimate",
			qualifiers: expect.arrayContaining([
				{
					namespace: "catalog.metadata",
					key: "playtime-estimator",
					kind: "string",
					value: "reported_average",
					path: "/length_minutes",
				},
				{
					namespace: "catalog.metadata",
					key: "playtime-sample-count",
					kind: "number",
					value: 10,
					path: "/length_votes",
				},
			]),
		});
		expect(planVndbSemantics({ id: "s1", lang: "ta" }).facts).toContainEqual({
			namespace: "catalog.metadata",
			key: "primary-language",
			kind: "string",
			value: "tl",
			path: "/lang",
		});
		expect(
			planVndbSemantics({ id: "v1", description: "Native content description" }).facts,
		).toEqual([]);
	});
	it("represents dump supersession, producer roles, DRM notes and animation separately", () => {
		const dump = {
			release: {
				id: "r1",
				olang: "en",
				gtin: "0",
				released: 20269999,
				voiced: 0,
				reso_x: 0,
				reso_y: 0,
				minage: null,
				patch: false,
				freeware: false,
				uncensored: null,
				official: true,
				has_ero: false,
				catalog: "",
				notes: "",
				engine: 5,
				ani_story: 3,
				ani_ero: 0,
				ani_bg: true,
				ani_face: false,
			},
			titles: [{ id: "r1", lang: "en", mtl: false, title: "Title", latin: null }],
			supersedes: [{ id: "r1", rid: "r2" }],
			drm: [{ id: "r1", drm: 1, notes: "Requires online setup" }],
			producers: [{ id: "r1", pid: "p1", developer: true, publisher: true }],
		};
		const native = planVndbDumpRelease(dump),
			semantics = planVndbDumpReleaseSemantics(dump);
		expect(native.details.isPatch).toBe(false);
		expect(semantics.relations.map((row) => row.key)).toEqual([
			"supersedes-release",
			"uses-access-mechanism",
			"uses-software-engine",
			"developed-by",
			"published-by",
		]);
		expect(semantics.relations[1]?.qualifiers[0]).toMatchObject({
			key: "access-mechanism-note",
			value: "Requires online setup",
			path: "/drm/0/notes",
		});
		expect(semantics.facts).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					key: "story-animation-summary",
					value: "some_fully_animated_scenes",
				}),
				expect.objectContaining({ key: "background-effects", value: true }),
			]),
		);
	});
	it("uses stable native occurrence IDs and source-local named-form keys", () => {
		const source = "01900000-0000-7000-8000-000000000001",
			medium = "01900000-0000-7000-8000-000000000002";
		expect(
			vndbReleaseComponentId(source, "medium/dvd/0", {
				kind: "medium",
				mediumTypeRevisionId: medium,
				quantity: 1,
			}),
		).toBe(
			vndbReleaseComponentId(source, "medium/dvd/0", {
				kind: "medium",
				mediumTypeRevisionId: medium,
				quantity: 3,
			}),
		);
		const names = planVndbNativeNames(
			{
				id: "v1",
				title: "VN",
				titles: [{ lang: "ta", title: "Pamagat", latin: null, official: false, main: true }],
				aliases: ["Alias", "Alias"],
			},
			"vn",
		);
		expect(names[1]).toMatchObject({
			key: "title/tl",
			fields: { languageTag: "tl", origin: "original" },
			official: { value: false, path: "/titles/0/official" },
		});
		expect(names[2]?.key).not.toBe(names[3]?.key);
	});
});
