import {
	PostApiFeedQueryStatus200ItemsPostKindEnum,
	PostApiFeedQueryStatus200ItemsOwnerEnum,
} from "@rezics/openapi-tanstack-query";
import { describe, expect, it } from "vitest";

import { getFeedActionPolicy } from "./feed-action-policy";

describe("getFeedActionPolicy", () => {
	it("covers every generated post kind with discussion actions", () => {
		for (const postKind of [
			...Object.values(PostApiFeedQueryStatus200ItemsPostKindEnum),
			"review" as const,
		]) {
			expect(getFeedActionPolicy({ itemType: "post", postKind })).toEqual({
				discussion: "replies",
				primary: "none",
			});
		}
	});

	it.each(["collection", "realm", "zone"] as const)("gives %s Units a follow action", (owner) => {
		expect(getFeedActionPolicy({ itemType: "unit", owner })).toEqual({
			discussion: "none",
			primary: "follow",
		});
	});

	it.each(["publishing", "music", "program", "software", "grouping", "tag"] as const)(
		"gives %s Units a discussion destination",
		(owner) => {
			expect(getFeedActionPolicy({ itemType: "unit", owner })).toMatchObject({
				discussion: "discussions",
			});
		},
	);

	it("covers every generated unit kind", () => {
		for (const owner of Object.values(PostApiFeedQueryStatus200ItemsOwnerEnum)) {
			expect(() => getFeedActionPolicy({ itemType: "unit", owner })).not.toThrow();
		}
	});
});
