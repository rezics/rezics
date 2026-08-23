import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";

import { CreateTagStructureBody, TagStructureResponse } from "./schema";

const uuid = (suffix: number) => `00000000-0000-7000-8000-${suffix.toString().padStart(12, "0")}`;

describe("VNDB v11 Tag API schemas", () => {
	it("carries the canonical maximum Path length through requests and responses", () => {
		expect(CreateTagStructureBody.properties.memberTagIds.maxItems).toBe(16);
		expect(TagStructureResponse.properties.members.maxItems).toBe(16);
		expect(
			Value.Check(CreateTagStructureBody, {
				memberTagIds: Array.from({ length: 17 }, (_, index) => uuid(index + 1)),
			}),
		).toBe(false);
	});
});
