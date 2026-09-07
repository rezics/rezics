import { describe, expect, it } from "vitest";
import { planBangumiApiRelation } from "./bangumi-api-relations";
import { planBangumiArchiveRelation } from "./bangumi-relations";

describe("Bangumi relation contexts", () => {
	it("keeps each nested voice credit tied to its source subject and character", () => {
		const row = {
			id: 77,
			type: 1,
			name: "Character",
			images: null,
			summary: "",
			relation: "main",
			actors: [
				{
					id: 3914,
					type: 1,
					name: "Actor",
					images: null,
					career: ["seiyu"],
					short_summary: "",
					locked: false,
				},
				{ id: 3915, type: 1, name: "Another actor", images: null, career: ["seiyu"] },
			],
		};
		const first = planBangumiApiRelation("subject_characters", row, 253, 0);
		const second = planBangumiApiRelation("subject_characters", row, 254, 1);
		expect(first.participants).toEqual([
			{ role: "subject", objectType: "subject", id: 253 },
			{ role: "character", objectType: "character", id: 77 },
			{ role: "person", objectType: "person", id: 3914 },
		]);
		expect(second.participants[0]?.id).toBe(254);
		expect(second.participants[2]?.id).toBe(3915);
		expect(() => planBangumiApiRelation("subject_characters", row, 253, 2)).toThrow();
	});
	it("retains subject context in reverse person/character endpoint relations", () => {
		const row = {
			id: 77,
			type: 1,
			name: "Character",
			images: null,
			subject_id: 253,
			subject_type: 2 as const,
			subject_name: "Program",
			subject_name_cn: "",
			staff: "main",
		};
		expect(planBangumiApiRelation("person_characters", row, 3914).participants).toEqual([
			{ role: "person", objectType: "person", id: 3914 },
			{ role: "character", objectType: "character", id: 77 },
			{ role: "subject", objectType: "subject", id: 253 },
		]);
	});
	it("preserves sparse order, episode participation and ended/spoiler qualifiers", () => {
		expect(
			planBangumiArchiveRelation({
				kind: "subject-characters",
				subject_id: 253,
				character_id: 77,
				type: 1,
				order: 999,
			}).qualifiers,
		).toContainEqual({ key: "order", value: 999 });
		expect(
			planBangumiArchiveRelation({
				kind: "subject-persons",
				subject_id: 253,
				person_id: 3914,
				position: 4,
				appear_eps: "1,3-7",
			}).qualifiers,
		).toContainEqual({ key: "appear_eps", value: "1,3-7" });
		const plan = planBangumiArchiveRelation({
			kind: "person-relations",
			person_type: "crt",
			person_id: 77,
			related_person_id: 78,
			relation_type: 1001,
			spoiler: 1,
			ended: 0,
		});
		expect(plan.spoiler).toBe(1);
		expect(plan.qualifiers).toContainEqual({ key: "ended", value: false });
		expect(plan.participants.every((value) => value.objectType === "character")).toBe(true);
	});
});
