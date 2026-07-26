import { describe, expect, it } from "vitest";

import { collectNewPostUnitMentionIds } from "./tag-mentions";

const first = "019f73cb-926e-7e50-9a7f-da67701accb3";
const second = "019f73cb-926e-7e50-9a7f-da67701accb4";

function document(...unitIds: string[]) {
	return {
		_type: "portable-text",
		_key: "a10000000001",
		content: [
			{
				_key: "block",
				_type: "block",
				children: unitIds.map((unitId, index) => ({
					_key: `mention-${index}`,
					_type: "unit-mention",
					unitId,
				})),
			},
		],
	};
}

describe("Post Unit mention side effects", () => {
	it("returns only distinct mentions newly added to the document", () => {
		expect(
			collectNewPostUnitMentionIds(document(first), document(first, second, second)),
		).toEqual([second]);
	});

	it("does not interpret mention removal as a reversible vote", () => {
		expect(collectNewPostUnitMentionIds(document(first), document())).toEqual([]);
	});
});
