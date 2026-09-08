import { describe, expect, it } from "vitest";
import { planBangumiNativeRelationFacts } from "./bangumi-relation-native";
import { planBangumiArchiveRelation, BangumiRelationMappingSchema } from "./bangumi-relations";

const definition = "00000000-0000-4000-8000-000000000001";
describe("Bangumi native relation interpretation", () => {
	it("preserves numeric and boolean qualifiers through registered native definitions", () => {
		const plan = planBangumiArchiveRelation({
			kind: "person-relations",
			person_type: "crt",
			person_id: 1,
			related_person_id: 2,
			relation_type: 7,
			spoiler: 1,
			ended: 0,
		});
		const mapping = BangumiRelationMappingSchema.parse({
			predicateRevisionId: definition,
			roles: {},
			qualifiers: { relation_type: definition, ended: definition },
		});
		expect(planBangumiNativeRelationFacts(plan, mapping)).toEqual([
			{
				identity: "relation_type",
				path: "/relation_type",
				definitionRevisionId: definition,
				kind: "number",
				value: 7,
			},
			{
				identity: "ended",
				path: "/ended",
				definitionRevisionId: definition,
				kind: "boolean",
				value: false,
			},
		]);
		expect(plan.spoiler).toBe(1);
	});
	it("rejects a missing reviewed qualifier instead of silently dropping source context", () => {
		const plan = planBangumiArchiveRelation({
			kind: "subject-persons",
			subject_id: 1,
			person_id: 2,
			position: 3,
			appear_eps: "1-5",
		});
		const mapping = BangumiRelationMappingSchema.parse({
			predicateRevisionId: definition,
			roles: {},
			qualifiers: { position: definition },
		});
		expect(() => planBangumiNativeRelationFacts(plan, mapping)).toThrow("appear_eps");
	});
});
