import { describe, expect, it } from "vitest";

import { presentSubjectAssociationSpoiler } from "./subject-association-spoiler";

describe("subject association spoiler presentation", () => {
	it("conceals a majority-major appearance by default", () => {
		expect(
			presentSubjectAssociationSpoiler(
				{
					spoilerVoteCount: 3n,
					spoilerNoneCount: 1n,
					spoilerMinorCount: 0n,
					spoilerMajorCount: 2n,
					viewerSpoilerLevel: null,
				},
				false,
			),
		).toMatchObject({ level: 2, concealed: true, voteCount: 3 });
	});

	it("keeps the evidence while honoring always-show", () => {
		expect(
			presentSubjectAssociationSpoiler(
				{
					spoilerVoteCount: 1n,
					spoilerNoneCount: 0n,
					spoilerMinorCount: 1n,
					spoilerMajorCount: 0n,
					viewerSpoilerLevel: 1,
				},
				true,
			),
		).toEqual({
			level: 1,
			concealed: false,
			voteCount: 1,
			distribution: { none: 0, minor: 1, major: 0 },
			viewerLevel: 1,
		});
	});
});
