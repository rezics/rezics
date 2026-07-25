import { describe, expect, it } from "vitest";

import { getFeedReactionScore, parseFeedReaction } from "./feed-reaction";

describe("feed reactions", () => {
	it("rejects unknown API reaction values", () => {
		expect(parseFeedReaction("upvote")).toBe("upvote");
		expect(parseFeedReaction("downvote")).toBe("downvote");
		expect(parseFeedReaction("future-reaction")).toBeNull();
	});

	it("derives optimistic scores relative to the confirmed reaction", () => {
		expect(getFeedReactionScore({ current: "upvote", initial: null, score: 10 })).toBe(11);
		expect(getFeedReactionScore({ current: "downvote", initial: "upvote", score: 10 })).toBe(8);
		expect(getFeedReactionScore({ current: null, initial: "downvote", score: 10 })).toBe(11);
	});
});
