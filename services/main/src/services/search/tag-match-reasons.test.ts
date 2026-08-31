import { PgDialect } from "drizzle-orm/pg-core";
import { beforeEach, describe, expect, it, vi } from "vitest";

const execute = vi.hoisted(() => vi.fn());

vi.mock("../database", () => ({ database: { execute } }));

import { getTagPositionAvailability, SearchTagPositionLookupLimit } from "./tag-match-reasons";

const TagId = "019913b0-7a80-7000-8000-000000000001";

describe("Tag position availability", () => {
	beforeEach(() => execute.mockReset());

	it("uses only the bigint primary-key projection and preserves counts above int32", async () => {
		execute.mockResolvedValue({
			rows: [
				{
					tagId: TagId,
					hasOtherPositions: true,
					otherPositionCount: "2999999999",
				},
			],
		});
		const result = await getTagPositionAvailability([TagId]);
		expect(result.get(TagId)).toEqual({
			hasOtherPositions: true,
			otherPositionCount: 2_999_999_999,
		});
		const query = new PgDialect().sqlToQuery(execute.mock.calls[0]![0]).sql;
		expect(query).toContain("tag_public_position_stat");
		expect(query).toContain("public_position_count");
		expect(query).not.toContain("tag_path_member");
		expect(query).not.toContain("count(*)");
	});

	it("returns explicit false and zero when a requested Tag has no projection result", async () => {
		execute.mockResolvedValue({ rows: [] });
		expect((await getTagPositionAvailability([TagId])).get(TagId)).toEqual({
			hasOtherPositions: false,
			otherPositionCount: 0,
		});
	});

	it("rejects request paths larger than fifty unique primary-key lookups", async () => {
		const ids = Array.from(
			{ length: SearchTagPositionLookupLimit + 1 },
			(_, index) => `019913b0-7a80-7000-8000-${index.toString(16).padStart(12, "0")}`,
		);
		await expect(getTagPositionAvailability(ids)).rejects.toThrow("50 primary-key reads");
		expect(execute).not.toHaveBeenCalled();
	});
});
