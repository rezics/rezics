import { describe, expect, it } from "vitest";
import { planVndbParticipation } from "./vndb-participation";
import { SoftwareParticipationValuesSchema } from "./software-participation";

describe("native software participation", () => {
	it("keeps exact aliases, local staff contexts, roles and character-specific voice occurrences", () => {
		const result = planVndbParticipation({
			id: "v17",
			title: "VN",
			editions: [{ eid: 1, lang: "ja", name: "Original staff", official: true }],
			staff: [{ id: "s2", aid: 23, eid: 1, role: "music", note: null }],
			va: [
				{ staff: { id: "s2", aid: 24 }, character: { id: "c1" }, note: "Opening" },
				{ staff: { id: "s2", aid: 24 }, character: { id: "c2" }, note: null },
			],
		});
		expect(result[0]).toMatchObject({ aliasId: 23, contextKey: "1", role: "composer" });
		expect(result.slice(1)).toMatchObject([
			{ aliasId: 24, contextKey: null, characterId: "c1" },
			{ aliasId: 24, contextKey: null, characterId: "c2" },
		]);
	});
	it("rejects absent snapshot-local contexts and unreviewed staff roles", () => {
		expect(() =>
			planVndbParticipation({
				id: "v1",
				title: "VN",
				staff: [{ id: "s2", aid: 23, eid: 1, role: "music", note: null }],
			}),
		).toThrow(/same snapshot/);
		expect(() =>
			planVndbParticipation({
				id: "v1",
				title: "VN",
				staff: [{ id: "s2", aid: 23, eid: null, role: "new-role", note: null }],
			}),
		).toThrow();
	});
	it("requires paired exact native alias and context references", () => {
		expect(() =>
			SoftwareParticipationValuesSchema.parse({
				entityId: crypto.randomUUID(),
				name: { id: crypto.randomUUID() },
				context: null,
				characterId: null,
				roleRevisionId: crypto.randomUUID(),
				note: null,
				state: "active",
			}),
		).toThrow();
		expect(() =>
			SoftwareParticipationValuesSchema.parse({
				entityId: crypto.randomUUID(),
				name: null,
				context: { id: crypto.randomUUID(), revision: 0 },
				characterId: null,
				roleRevisionId: crypto.randomUUID(),
				note: null,
				state: "active",
			}),
		).toThrow();
	});
});
