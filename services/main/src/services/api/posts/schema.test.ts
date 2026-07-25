import { Check } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";

import { ReplacePostScoresBody } from "./schema";

describe("Post Score API contracts", () => {
	it("temporarily limits the replacement body to one Score", () => {
		const items = Array.from({ length: 2 }, (_, index) => ({
			scoreId: `0195c49b-8f3b-7e18-8c45-c2f36ee8d33${index}`,
		}));
		expect(Check(ReplacePostScoresBody, [])).toBe(true);
		expect(Check(ReplacePostScoresBody, items.slice(0, 1))).toBe(true);
		expect(Check(ReplacePostScoresBody, items)).toBe(false);
	});
});
