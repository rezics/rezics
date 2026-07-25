import {
	GetApiFeedStatus200ItemsPostKindEnum,
	GetApiFeedStatus200ItemsUnitKindEnum,
} from "@rezics/openapi-tanstack-query";
import { describe, expect, it } from "vitest";

import { getFeedActionPolicy } from "./feed-action-policy";

describe("getFeedActionPolicy", () => {
	it("covers every generated post kind with discussion actions", () => {
		for (const postKind of [
			...Object.values(GetApiFeedStatus200ItemsPostKindEnum),
			"review" as const,
		]) {
			expect(getFeedActionPolicy({ itemType: "post", postKind })).toEqual({
				comments: true,
				primary: "none",
			});
		}
	});

	it("gives collections a follow action", () => {
		expect(getFeedActionPolicy({ itemType: "unit", unitKind: "collection" })).toEqual({
			comments: false,
			primary: "follow",
		});
	});

	it("covers every generated unit kind", () => {
		for (const unitKind of Object.values(GetApiFeedStatus200ItemsUnitKindEnum)) {
			expect(() => getFeedActionPolicy({ itemType: "unit", unitKind })).not.toThrow();
		}
	});
});
