import type { GetApiUnitsByTypeByUnitIdTagsStatus200 } from "@rezics/openapi-tanstack-query";
import { describe, expect, it } from "vitest";

import { presentGlobalTags, presentRealmTagGroups } from "./unit-tag-presentation";

const Timestamp = "2026-07-24T00:00:00.000Z";
const UnitId = "019b76da-a800-7300-8000-000000000001";

function landscape(): GetApiUnitsByTypeByUnitIdTagsStatus200 {
	return {
		paths: [],
		totals: { paths: 0, global: 1 },
		global: [
			{
				tagId: "global-tag",
				language: "en",
				title: "Fantasy",
				summary: null,
				avatar: null,
				createdAt: Timestamp,
				updatedAt: Timestamp,
				pinned: false,
				position: null,
				score: "4",
				voteCount: "6",
				viewerVote: 1,
			},
		],
		realms: [
			{
				realmId: "realm-a",
				language: "en",
				title: "Readers",
				summary: null,
				avatar: { type: "emoji", emoji: "📚" },
				canVote: true,
				position: "a0",
				createdAt: Timestamp,
				updatedAt: Timestamp,
				votedTags: [
					{
						realmId: "realm-a",
						tagId: "shared-tag",
						language: "en",
						title: "Voted title",
						summary: "Contextual summary",
						avatar: null,
						contextPostId: "post-a",
						score: 3,
						voteCount: 5,
						viewerVote: -1,
						createdAt: Timestamp,
						updatedAt: Timestamp,
					},
				],
			},
		],
		voteRealms: [
			{
				realmId: "realm-a",
				language: "en",
				title: "Readers",
				summary: null,
				avatar: null,
			},
		],
	};
}

describe("Unit Tag presentation", () => {
	it("keeps the global vote target explicit and hides signed-out vote actions", () => {
		const [tag] = presentGlobalTags({
			data: landscape(),
			type: "book",
			unitId: UnitId,
			signedIn: false,
		});
		expect(tag?.vote).toEqual({
			kind: "available",
			target: {
				kind: "global",
				type: "book",
				unitId: UnitId,
				tagId: "global-tag",
			},
			score: 4,
			voteCount: 6,
			viewerVote: 1,
			canVote: false,
		});
	});

	it("keeps each Realm vote target bound to its source context", () => {
		const [group] = presentRealmTagGroups({ data: landscape(), unitId: UnitId });
		expect(group?.avatar).toEqual({ type: "emoji", emoji: "📚" });
		expect(group?.tags).toHaveLength(1);
		expect(group?.tags[0]).toMatchObject({
			identity: {
				tagId: "shared-tag",
				title: "Voted title",
				summary: "Contextual summary",
				avatar: null,
			},
			context: {
				kind: "realm",
				realmId: "realm-a",
				contextPostId: "post-a",
			},
			vote: {
				kind: "available",
				target: {
					kind: "realm",
					realmId: "realm-a",
					unitId: UnitId,
					tagId: "shared-tag",
				},
			},
		});
	});
});
