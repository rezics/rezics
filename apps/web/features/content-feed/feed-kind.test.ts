import { describe, expect, it } from "vitest";

import {
	DefaultFeedContentKinds,
	DefaultPostListContentKinds,
	feedContentKindGroup,
	FeedContentKinds,
	PostListContentKinds,
} from "./feed-kind";

describe("feed content kinds", () => {
	it("supports public Unit and Post kinds without enabling replies by default", () => {
		expect(FeedContentKinds).toContain("unit:book");
		expect(FeedContentKinds).toContain("post:reply");
		expect(DefaultFeedContentKinds).not.toContain("post:reply");
		expect(DefaultFeedContentKinds).toContain("post:post");
		expect(DefaultFeedContentKinds).toContain("post:excerpt");
	});

	it("keeps PostList narrow and post-first", () => {
		expect(PostListContentKinds).toEqual(["post:post", "post:reply"]);
		expect(DefaultPostListContentKinds).toEqual(["post:post"]);
	});

	it("retains the namespace as the option group proof", () => {
		expect(feedContentKindGroup("unit:media")).toBe("unit");
		expect(feedContentKindGroup("post:review")).toBe("post");
	});
});
