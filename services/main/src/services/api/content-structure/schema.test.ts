import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";

import { SaveBookContentStructureDraftBody } from "./schema";

describe("Content Structure API schemas", () => {
	it("accepts an attached Unit reference without client-owned presentation", () => {
		const body = {
			baseRevisionId: "018ff2b7-7c00-7000-8000-000000000001",
			nodes: [
				{
					state: "attached",
					id: "018ff2b7-7c00-7000-8000-000000000002",
					parentId: null,
					order: 0,
					contentUnitId: "018ff2b7-7c00-7000-8000-000000000003",
				},
			],
		};

		expect(Value.Check(SaveBookContentStructureDraftBody, body)).toBe(true);
		expect(
			Value.Check(SaveBookContentStructureDraftBody, {
				...body,
				nodes: [{ ...body.nodes[0], title: "Untrusted title" }],
			}),
		).toBe(false);
	});
});
