import { describe, expect, it } from "vitest";

import { paginateUnitReferences } from "./reference-pagination";

const UnitId = "018ff2b7-7c00-7000-8000-000000000001";

function reference(
	id: string,
	input: {
		readonly pinned?: boolean;
		readonly position?: string | null;
		readonly score?: number;
		readonly voteCount?: number;
	} = {},
) {
	return {
		id,
		pinned: input.pinned ?? false,
		position: input.position ?? null,
		voteSummary: {
			score: input.score ?? 0,
			voteCount: input.voteCount ?? 0,
		},
	};
}

describe("Unit reference pagination", () => {
	it("keeps curated references first and continues by the complete rank tuple", () => {
		const references = [
			reference("018ff2b7-7c00-7000-8000-000000000004", { score: 1, voteCount: 1 }),
			reference("018ff2b7-7c00-7000-8000-000000000003", { score: 2, voteCount: 4 }),
			reference("018ff2b7-7c00-7000-8000-000000000002", {
				pinned: true,
				position: "a0",
				score: -1,
				voteCount: 1,
			}),
		];
		const context = {
			unitId: UnitId,
			kind: "alias" as const,
			curationVersion: 2,
			rankingVersion: "a".repeat(64),
		};
		const first = paginateUnitReferences({ references, context, limit: 2 });
		expect(first.items.map(({ id }) => id)).toEqual([
			"018ff2b7-7c00-7000-8000-000000000002",
			"018ff2b7-7c00-7000-8000-000000000003",
		]);
		expect(first.nextCursor).not.toBeNull();
		const second = paginateUnitReferences({
			references,
			context,
			cursor: first.nextCursor ?? undefined,
			limit: 2,
		});
		expect(second.items.map(({ id }) => id)).toEqual(["018ff2b7-7c00-7000-8000-000000000004"]);
		expect(second.nextCursor).toBeNull();
	});

	it("rejects a cursor after the curation version changes", () => {
		const references = [
			reference("018ff2b7-7c00-7000-8000-000000000002"),
			reference("018ff2b7-7c00-7000-8000-000000000003"),
		];
		const first = paginateUnitReferences({
			references,
			context: {
				unitId: UnitId,
				kind: "external_link",
				curationVersion: 0,
				rankingVersion: "a".repeat(64),
			},
			limit: 1,
		});
		expect(() =>
			paginateUnitReferences({
				references,
				context: {
					unitId: UnitId,
					kind: "external_link",
					curationVersion: 1,
					rankingVersion: "a".repeat(64),
				},
				cursor: first.nextCursor ?? undefined,
				limit: 1,
			}),
		).toThrow();
	});
});
