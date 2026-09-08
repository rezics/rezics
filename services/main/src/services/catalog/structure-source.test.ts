import { describe, expect, it } from "vitest";
import {
	prepareStructureSourceProjection,
	structureSourceComponent,
	CatalogStructureSourceChangeSchema,
} from "./structure-source-contracts";
import { mergeStructureSourceProjection } from "./structure-source";
const sourceType = "00000000-0000-4000-8000-000000000001";
const nextType = "00000000-0000-4000-8000-000000000002";
const localType = "00000000-0000-4000-8000-000000000003";
describe("pure Program and Publishing source structures", () => {
	it("keeps only explicitly observed fields in every fixed native shape", () => {
		for (const [owner, shape, component] of [
			["program", "program", "program_work"],
			["program", "season", "program_season"],
			["program", "program_version", "program_version"],
			["program", "episode", "program_episode"],
			["publishing", "work", "publishing_work"],
			["publishing", "text_version", "publishing_text_version"],
			["publishing", "publication", "publishing_publication"],
			["publishing", "serialization", "publishing_serialization"],
		] as const) {
			const value = prepareStructureSourceProjection(owner, { shape, fields: {} }, []);
			expect(structureSourceComponent(owner, value.value)).toBe(component);
			expect(value.observedFields).toEqual([]);
		}
		const projected = prepareStructureSourceProjection(
			"program",
			{ shape: "program", fields: { typeRevisionId: sourceType, declaredMainEpisodeCount: 42 } },
			["typeRevisionId"],
		);
		expect(projected.value).toEqual({
			shape: "program",
			fields: {
				typeRevisionId: sourceType,
				declaredMainEpisodeCount: null,
				declaredTotalEpisodeCount: null,
			},
		});
	});
	it("preserves independent human fields and unchanged source overrides while rejecting competing edits", () => {
		const before = prepareStructureSourceProjection(
			"program",
			{ shape: "program", fields: { typeRevisionId: sourceType } },
			["typeRevisionId"],
		);
		const after = prepareStructureSourceProjection(
			"program",
			{ shape: "program", fields: { typeRevisionId: nextType } },
			["typeRevisionId"],
		);
		expect(
			mergeStructureSourceProjection("program", before, after, {
				shape: "program",
				fields: { typeRevisionId: sourceType, declaredMainEpisodeCount: 7 },
			}),
		).toMatchObject({ fields: { typeRevisionId: nextType, declaredMainEpisodeCount: 7 } });
		expect(
			mergeStructureSourceProjection("program", before, before, {
				shape: "program",
				fields: { typeRevisionId: localType, declaredMainEpisodeCount: 7 },
			}),
		).toMatchObject({ fields: { typeRevisionId: localType, declaredMainEpisodeCount: 7 } });
		expect(() =>
			mergeStructureSourceProjection("program", before, after, {
				shape: "program",
				fields: { typeRevisionId: localType },
			}),
		).toThrow(/conflicts/);
	});
	it("handles native publication fields without pretending an observed page count covers local pagination", () => {
		const before = prepareStructureSourceProjection(
			"publishing",
			{
				shape: "publication",
				fields: { pageCount: 100, paginationText: "Human must not become source" },
			},
			["pageCount"],
		);
		const after = prepareStructureSourceProjection(
			"publishing",
			{ shape: "publication", fields: { pageCount: 120 } },
			["pageCount"],
		);
		expect(before.value).toMatchObject({ fields: { pageCount: 100, paginationText: null } });
		expect(
			mergeStructureSourceProjection("publishing", before, after, {
				shape: "publication",
				fields: { pageCount: 100, paginationText: "xiv, 100" },
			}),
		).toMatchObject({ fields: { pageCount: 120, paginationText: "xiv, 100" } });
	});
	it("rejects invented fields, duplicate observations, scope narrowing and mismatched journal owners", () => {
		expect(() =>
			prepareStructureSourceProjection("program", { shape: "program", fields: {} }, ["title"]),
		).toThrow(/outside/);
		expect(() =>
			prepareStructureSourceProjection("program", { shape: "program", fields: {} }, [
				"typeRevisionId",
				"typeRevisionId",
			]),
		).toThrow(/Duplicate/);
		const before = prepareStructureSourceProjection("program", { shape: "program", fields: {} }, [
			"typeRevisionId",
		]);
		const after = prepareStructureSourceProjection("program", { shape: "program", fields: {} }, []);
		expect(() => mergeStructureSourceProjection("program", before, after, before.value)).toThrow(
			/observation/,
		);
		expect(
			CatalogStructureSourceChangeSchema.safeParse({
				kind: "catalog-structure",
				owner: "program",
				ownerId: sourceType,
				component: "publishing_work",
				componentKey: sourceType,
				beforeRevisionId: sourceType,
				afterRevisionId: nextType,
			}).success,
		).toBe(false);
	});
});
