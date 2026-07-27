import { describe, expect, it } from "vitest";

import {
	createProfileContentRequest,
	normalizeProfileContentKinds,
	profileContentParser,
} from "./profile-content-query";

const ProfileId = "019b0000-0000-7000-8000-000000000004";

describe("Profile content page requests", () => {
	it("uses the canonical Profile Search context for an update-ordered Feed", () => {
		expect(createProfileContentRequest({ contentKinds: [], profileId: ProfileId })).toEqual({
			contexts: [{ kind: "profile", profileId: ProfileId }],
			injections: [],
			state: {
				pageSize: 20,
				sort: "updatedAt:desc",
			},
		});
	});

	it("composes selected content kinds into the Feed filter", () => {
		expect(
			createProfileContentRequest({
				contentKinds: ["unit:collection", "post:review"],
				profileId: ProfileId,
			}),
		).toEqual({
			contexts: [{ kind: "profile", profileId: ProfileId }],
			injections: [],
			state: {
				filter: {
					where: {
						any: [
							{ kind: { in: ["collection"] } },
							{ post: { is: { kind: { in: ["review"] } } } },
						],
					},
				},
				pageSize: 20,
				sort: "updatedAt:desc",
			},
		});
	});

	it("keeps only content kinds supported by the Profile feed", () => {
		expect(
			normalizeProfileContentKinds([
				"unit:book",
				"post:picture",
				"unit:collection",
				"post:picture",
			]),
		).toEqual(["unit:collection", "post:picture"]);
	});

	it("parses only Profile feed content kinds from the URL", () => {
		expect(profileContentParser.parseServerSide(undefined)).toEqual([]);
		expect(
			profileContentParser.parseServerSide(
				"unit:entity,unit:book,post:review,post:picture,unknown",
			),
		).toEqual(["unit:entity", "post:review", "post:picture"]);
	});
});
