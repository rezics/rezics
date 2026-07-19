import { type SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { beforeEach, describe, expect, it, vi } from "vitest";

const execute = vi.hoisted(() => vi.fn());

vi.mock("../../database", () => ({ database: { execute } }));

import { InvalidPaginationCursor } from "../../pagination/errors";
import { ReplyTreePolicy, selectReplyTree } from "./reply-tree-query";

const dialect = new PgDialect();
const rootPostId = "11111111-1111-1111-8111-111111111111";
const firstPostId = "22222222-2222-2222-8222-222222222222";
const childPostId = "33333333-3333-3333-8333-333333333333";

describe("bounded reply tree query", () => {
	beforeEach(() => {
		execute.mockReset();
		execute.mockResolvedValue({ rows: [] });
	});

	it("bounds the root page and each recursive child preview", async () => {
		await selectReplyTree({ rootPostId });

		const statement = execute.mock.calls[0]?.[0] as SQL | undefined;
		if (!statement) throw new Error("Reply tree query did not execute");
		const query = dialect.sqlToQuery(statement);
		expect(query.sql).toContain("WITH RECURSIVE");
		expect(query.sql).toContain("CROSS JOIN LATERAL");
		expect(query.sql).toContain('AS "hasMoreChildren"');
		expect(query.params).toEqual(
			expect.arrayContaining([
				rootPostId,
				ReplyTreePolicy.rootLimit + 1,
				ReplyTreePolicy.rootLimit,
				ReplyTreePolicy.childPreviewLimit,
				ReplyTreePolicy.maxCommentLevels - 1,
			]),
		);
	});

	it("returns independently scoped cursors for roots and child connections", async () => {
		execute.mockResolvedValueOnce({
			rows: [
				{
					postId: firstPostId,
					parentPostId: null,
					createdAt: new Date("2026-07-19T00:00:00.000Z"),
					relativeDepth: 0,
					hasMoreChildren: true,
					hasNextPage: true,
				},
				{
					postId: childPostId,
					parentPostId: firstPostId,
					createdAt: new Date("2026-07-19T00:01:00.000Z"),
					relativeDepth: 1,
					hasMoreChildren: false,
					hasNextPage: true,
				},
			],
		});

		const page = await selectReplyTree({ rootPostId });
		const childCursor = page.items[0]?.childEndCursor;
		expect(page.nextCursor).toBeTruthy();
		expect(childCursor).toBeTruthy();

		await expect(
			selectReplyTree({ rootPostId, cursor: childCursor ?? undefined }),
		).rejects.toBeInstanceOf(InvalidPaginationCursor);
		await expect(
			selectReplyTree({
				rootPostId,
				parentPostId: firstPostId,
				cursor: childCursor ?? undefined,
			}),
		).resolves.toEqual({ items: [], nextCursor: null });
	});
});
