import type { GetApiPostsByPostIdRepliesStatus200 } from "@rezics/openapi-tanstack-query";
import { createPortableTextDocument } from "@rezics/block";
import { describe, expect, it } from "vitest";

import { buildReplyPostTree } from "./reply-tree";

type ApiReplyPost = GetApiPostsByPostIdRepliesStatus200["items"][number];

function createReplyPost(id: string, parentPostId: string | null = null): ApiReplyPost {
	return {
		id,
		postKind: "reply",
		authorId: "author",
		authorName: "Author",
		rootPostId: "post",
		parentPostId,
		contextRealmId: null,
		depth: parentPostId ? 1 : 0,
		body: createPortableTextDocument([], "000000000000"),
		status: "approved",
		latestRevisionId: "019b1234-1234-7000-8000-000000000000",
		hasMoreChildren: false,
		childEndCursor: null,
		createdAt: "2026-01-01T00:00:00.000Z",
		updatedAt: "2026-01-01T00:00:00.000Z",
	};
}

describe("reply-post tree", () => {
	it("nests out-of-order replies under their parent post", () => {
		const tree = buildReplyPostTree([
			createReplyPost("child", "root"),
			createReplyPost("root"),
			createReplyPost("other"),
		]);

		expect(tree.map(({ id, children }) => [id, children.map((child) => child.id)])).toEqual([
			["root", ["child"]],
			["other", []],
		]);
	});

	it("keeps malformed parent links renderable", () => {
		const tree = buildReplyPostTree([
			createReplyPost("orphan", "missing"),
			createReplyPost("self", "self"),
			createReplyPost("first", "second"),
			createReplyPost("second", "first"),
		]);

		expect(tree.map((node) => node.id)).toEqual(["orphan", "self", "first", "second"]);
		expect(tree.every((node) => node.children.length === 0)).toBe(true);
	});
});
