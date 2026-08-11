import { describe, expect, it } from "vitest";

import { reviewFeedHref, reviewFeedSearchParams } from "./review-feed-search-params";

function requiredParam(params: URLSearchParams, name: string): string {
	const value = params.get(name);
	if (value === null) throw new Error(`Missing expected query parameter: ${name}`);
	return value;
}

describe("Review Feed route state", () => {
	it("carries every Feed filter from the preview into the full page", () => {
		const href = reviewFeedHref("/units/book/019f9000-0000-7000-8000-000000000001/reviews", {
			languages: ["zh", "en"],
			q: "memory",
			realms: ["019f9000-0000-7000-8000-000000000002"],
			scoreRealm: {
				id: "019f9000-0000-7000-8000-000000000003",
				label: "Readers",
			},
			scores: [8, 9],
			sort: "new",
			tags: ["019f9000-0000-7000-8000-000000000004"],
		});
		const params = new URL(href, "https://example.invalid").searchParams;

		expect(reviewFeedSearchParams.q.parseServerSide(requiredParam(params, "q"))).toBe("memory");
		expect(
			reviewFeedSearchParams.languages.parseServerSide(requiredParam(params, "languages")),
		).toEqual(["zh", "en"]);
		expect(reviewFeedSearchParams.realms.parseServerSide(requiredParam(params, "realms"))).toEqual([
			"019f9000-0000-7000-8000-000000000002",
		]);
		expect(
			reviewFeedSearchParams.scoreRealm.parseServerSide(requiredParam(params, "scoreRealm")),
		).toEqual({
			id: "019f9000-0000-7000-8000-000000000003",
			label: "Readers",
		});
		expect(reviewFeedSearchParams.scores.parseServerSide(requiredParam(params, "scores"))).toEqual([
			8, 9,
		]);
		expect(reviewFeedSearchParams.sort.parseServerSide(requiredParam(params, "sort"))).toBe("new");
		expect(reviewFeedSearchParams.tags.parseServerSide(requiredParam(params, "tags"))).toEqual([
			"019f9000-0000-7000-8000-000000000004",
		]);
	});
});
