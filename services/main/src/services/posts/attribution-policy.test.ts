import { describe, expect, it } from "vitest";

import { shouldCreateProfilePublisherAttributionForPost } from "./attribution-policy";

describe("Post publisher attribution policy", () => {
	it("creates an automatic publisher attribution only for profile-owned Posts", () => {
		expect(shouldCreateProfilePublisherAttributionForPost("profile_owned")).toBe(true);
		expect(shouldCreateProfilePublisherAttributionForPost("community_owned")).toBe(false);
	});
});
