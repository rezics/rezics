import { describe, expect, it } from "vitest";
import { PackObjectSchema, PackRelationsSchema } from "./schemas";
import { orderPackObjects } from "./identity";
import type { LoadedPack, PackObject } from "./contracts";

const name = { languageTag: "en", value: "Native fixture" };
const lifecycle = {
	status: "published",
	visibility: "public",
	contentRating: "general",
	aiDisclosure: "unknown",
	license: null,
	moderationStatus: "approved",
	postTargetingLocked: false,
};
function object(owner: string, shape: string, native: unknown): PackObject {
	return PackObjectSchema.parse({
		sourceKey: `fixture:${owner}:${shape}`,
		identity: { owner, shape, ...lifecycle },
		native,
		import: { ownershipMode: "community_owned", actorKind: "import" },
		localizations: [{ language: "en", title: name.value }],
	});
}
function pack(objects: readonly PackObject[]): LoadedPack {
	return {
		packDir: ".temp/native-pack-test",
		manifest: { id: "native-pack-test", version: "1.0.0" },
		checksum: "a".repeat(64),
		ids: {
			units: Object.fromEntries(
				objects.map((row, index) => [
					row.sourceKey,
					`019c0000-0000-7000-8000-${String(index + 1).padStart(12, "0")}`,
				]),
			),
		},
		rights: [],
		sourceLock: { kind: "cited-sources", retrievedOn: "2026-09-08", sources: [] },
		bindings: [],
		objects,
		relations: {},
		structures: [],
	};
}

describe("native content-pack identity contract", () => {
	it.each([
		["publishing", "text_version", { kind: "text_version", name, languageTag: "en" }],
		["music", "recording", { kind: "recording", name }],
		["program", "program", { kind: "program", name, structure: { shape: "program", fields: {} } }],
		["software", "content", { kind: "software_content", name }],
		["entity", "character", { kind: "entity", name, shape: "character" }],
		["grouping", "grouping", { kind: "grouping", name }],
		["reference", "concept", { kind: "reference", name, profile: { shape: "concept" } }],
		["distribution", "package", { kind: "distribution", name }],
	] as const)("requires a complete %s native declaration", (owner, shape, native) => {
		expect(object(owner, shape, native).identity).toMatchObject({ owner, shape });
	});
	it("rejects a native declaration whose owner or shape differs", () => {
		expect(() =>
			object("publishing", "work", { kind: "text_version", name, languageTag: "en" }),
		).toThrow(/match/);
		expect(() => object("program", "program", { kind: "recording", name })).toThrow(/match/);
	});
	it("does not allow a shape-only native identity or an old book detail", () => {
		expect(() => object("publishing", "work", undefined)).toThrow(/complete native/);
		const current = object("publishing", "work", { kind: "publishing_work", name });
		expect(
			PackObjectSchema.safeParse({ ...current, book: { releaseStatus: "released" } }).success,
		).toBe(false);
		expect(
			PackObjectSchema.safeParse({
				...current,
				identity: undefined,
				unit: { kind: "book", ...lifecycle },
			}).success,
		).toBe(false);
	});
	it("rejects old general variants and measurement fields", () => {
		expect(PackRelationsSchema.safeParse({ unitVariants: [] }).success).toBe(false);
		const current = object("entity", "character", { kind: "entity", name, shape: "character" });
		expect(PackObjectSchema.safeParse({ ...current, entityMeasurements: [] }).success).toBe(false);
	});
	it("orders concrete subtype dependencies before dependents", () => {
		const content = object("software", "content", { kind: "software_content", name });
		const version = object("software", "version", {
			kind: "software_version",
			name,
			content: { owner: "software", id: "019c0000-0000-7000-8000-000000000002" },
			details: { kind: "translation", distinguishingEvidence: "Independent translation" },
		});
		const value = pack([version, content]);
		expect(orderPackObjects(value).map((entry) => entry.identity.shape)).toEqual([
			"content",
			"version",
		]);
	});
	it("rejects cycles instead of creating partial identities", () => {
		const first = PackObjectSchema.parse({
			sourceKey: "first",
			identity: { owner: "post", shape: "post", ...lifecycle },
			import: { ownershipMode: "community_owned", actorKind: "import" },
			post: { kind: "post", subjectSourceKey: "second" },
			localizations: [{ language: "en", title: "First" }],
		});
		const second = {
			...first,
			sourceKey: "second",
			post: { kind: "post" as const, subjectSourceKey: "first" },
		};
		expect(() => orderPackObjects(pack([first, second]))).toThrow(/Cyclic/);
	});
});
