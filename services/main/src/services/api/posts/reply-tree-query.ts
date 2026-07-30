import { sql } from "drizzle-orm";
import { t } from "elysia";

import { database } from "../../database";
import { postReply, realmUnit } from "../../database/schema";
import { parseJsonCursor } from "../../pagination";
import { InvalidPaginationCursor } from "../../pagination/errors";
import { Uuid } from "../schema";

export const ReplyTreePolicy = {
	rootLimit: 25,
	childPreviewLimit: 5,
	maxCommentLevels: 2,
} as const;

const ReplyTreeCursor = t.Object(
	{
		v: t.Literal(2),
		rootPostId: Uuid,
		parentPostId: t.Nullable(Uuid),
		realmId: t.Nullable(Uuid),
		createdAt: t.String(),
		postId: Uuid,
	},
	{ additionalProperties: false },
);
type ReplyTreeCursor = typeof ReplyTreeCursor.static;

interface ReplyTreeSelectionRow extends Record<string, unknown> {
	postId: string;
	parentPostId: string | null;
	createdAt: Date;
	relativeDepth: number;
	hasMoreChildren: boolean;
	hasNextPage: boolean;
}

export interface ReplyTreeSelectionItem {
	postId: string;
	hasMoreChildren: boolean;
	childEndCursor: string | null;
}

function encodeReplyTreeCursor(value: ReplyTreeCursor) {
	return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function decodeReplyTreeCursor(
	value: string | undefined,
	rootPostId: string,
	parentPostId: string | null,
	realmId: string | null,
) {
	if (!value) return undefined;
	try {
		const cursor = parseJsonCursor(value, ReplyTreeCursor);
		if (
			cursor.rootPostId !== rootPostId ||
			cursor.parentPostId !== parentPostId ||
			cursor.realmId !== realmId ||
			Number.isNaN(Date.parse(cursor.createdAt))
		)
			throw new InvalidPaginationCursor();
		return { createdAt: new Date(cursor.createdAt), postId: cursor.postId };
	} catch {
		throw new InvalidPaginationCursor();
	}
}

function cursorFor(
	rootPostId: string,
	parentPostId: string | null,
	realmId: string | null,
	boundary: Pick<ReplyTreeSelectionRow, "createdAt" | "postId">,
) {
	return encodeReplyTreeCursor({
		v: 2,
		rootPostId,
		parentPostId,
		realmId,
		createdAt: boundary.createdAt.toISOString(),
		postId: boundary.postId,
	});
}

export async function selectReplyTree(input: {
	rootPostId: string;
	parentPostId?: string;
	realmId?: string;
	cursor?: string;
	limit?: number;
}) {
	const parentPostId = input.parentPostId ?? null;
	const realmId = input.realmId ?? null;
	const limit = input.limit ?? ReplyTreePolicy.rootLimit;
	const cursor = decodeReplyTreeCursor(input.cursor, input.rootPostId, parentPostId, realmId);
	const parentCondition = parentPostId
		? sql`anchor_reply.parent_post_id = ${parentPostId}`
		: sql`anchor_reply.parent_post_id IS NULL`;
	const cursorCondition = cursor
		? sql`AND (anchor_reply.created_at, anchor_reply.post_id) > (${cursor.createdAt}, ${cursor.postId})`
		: sql``;
	const realmCondition = input.realmId
		? sql`AND EXISTS (
			SELECT 1 FROM ${realmUnit} reply_realm
			WHERE reply_realm.realm_id = ${input.realmId}
				AND reply_realm.unit_id = anchor_reply.post_id
				AND reply_realm.status = 'visible'
				AND reply_realm.publication_state = 'active'
		)`
		: sql``;
	const childRealmCondition = input.realmId
		? sql`AND EXISTS (
			SELECT 1 FROM ${realmUnit} reply_realm
			WHERE reply_realm.realm_id = ${input.realmId}
				AND reply_realm.unit_id = candidate_reply.post_id
				AND reply_realm.status = 'visible'
				AND reply_realm.publication_state = 'active'
		)`
		: sql``;

	const result = await database.execute<ReplyTreeSelectionRow>(sql`
		WITH RECURSIVE
		anchor_candidates AS MATERIALIZED (
			SELECT
				anchor_reply.post_id,
				anchor_reply.parent_post_id,
				anchor_reply.created_at
			FROM ${postReply} anchor_reply
			WHERE anchor_reply.root_post_id = ${input.rootPostId}
				AND ${parentCondition}
				${cursorCondition}
				${realmCondition}
			ORDER BY anchor_reply.created_at, anchor_reply.post_id
			LIMIT ${limit + 1}
		),
		anchor_page AS (
			SELECT
				anchor_candidates.*,
				row_number() OVER (
					ORDER BY anchor_candidates.created_at, anchor_candidates.post_id
				) AS sibling_position
			FROM anchor_candidates
			ORDER BY anchor_candidates.created_at, anchor_candidates.post_id
			LIMIT ${limit}
		),
		reply_tree (
			post_id,
			parent_post_id,
			created_at,
			relative_depth,
			visited_ids,
			order_path
		) AS (
			SELECT
				anchor_page.post_id,
				anchor_page.parent_post_id,
				anchor_page.created_at,
				0,
				ARRAY[anchor_page.post_id],
				ARRAY[anchor_page.sibling_position]
			FROM anchor_page

			UNION ALL

			SELECT
				child_reply.post_id,
				child_reply.parent_post_id,
				child_reply.created_at,
				parent_reply.relative_depth + 1,
				parent_reply.visited_ids || child_reply.post_id,
				parent_reply.order_path || child_reply.sibling_position
			FROM reply_tree parent_reply
			CROSS JOIN LATERAL (
				SELECT
					candidate_reply.post_id,
					candidate_reply.parent_post_id,
					candidate_reply.created_at,
					row_number() OVER (
						ORDER BY candidate_reply.created_at, candidate_reply.post_id
					) AS sibling_position
				FROM ${postReply} candidate_reply
				WHERE candidate_reply.root_post_id = ${input.rootPostId}
					AND candidate_reply.parent_post_id = parent_reply.post_id
					${childRealmCondition}
				ORDER BY candidate_reply.created_at, candidate_reply.post_id
				LIMIT ${ReplyTreePolicy.childPreviewLimit}
			) child_reply
			WHERE parent_reply.relative_depth < ${ReplyTreePolicy.maxCommentLevels - 1}
				AND child_reply.post_id <> ALL(parent_reply.visited_ids)
		)
		SELECT
			reply_tree.post_id AS "postId",
			reply_tree.parent_post_id AS "parentPostId",
			reply_tree.created_at AS "createdAt",
			reply_tree.relative_depth AS "relativeDepth",
			EXISTS (
				SELECT 1
				FROM ${postReply} omitted_reply
				WHERE omitted_reply.root_post_id = ${input.rootPostId}
					AND omitted_reply.parent_post_id = reply_tree.post_id
					${
						input.realmId
							? sql`AND EXISTS (
							SELECT 1 FROM ${realmUnit} omitted_realm
							WHERE omitted_realm.realm_id = ${input.realmId}
								AND omitted_realm.unit_id = omitted_reply.post_id
								AND omitted_realm.status = 'visible'
								AND omitted_realm.publication_state = 'active'
						)`
							: sql``
					}
					AND NOT EXISTS (
						SELECT 1
						FROM reply_tree loaded_reply
						WHERE loaded_reply.parent_post_id = reply_tree.post_id
							AND loaded_reply.post_id = omitted_reply.post_id
					)
			) AS "hasMoreChildren",
			(SELECT count(*) > ${limit} FROM anchor_candidates) AS "hasNextPage"
		FROM reply_tree
		ORDER BY reply_tree.order_path
	`);

	const rows = result.rows;
	const lastLoadedChild = new Map<string, ReplyTreeSelectionRow>();
	for (const row of rows) {
		if (row.parentPostId) lastLoadedChild.set(row.parentPostId, row);
	}
	const items = rows.map((row): ReplyTreeSelectionItem => {
		const childBoundary = lastLoadedChild.get(row.postId);
		return {
			postId: row.postId,
			hasMoreChildren: row.hasMoreChildren,
			childEndCursor:
				row.hasMoreChildren && childBoundary
					? cursorFor(input.rootPostId, row.postId, realmId, childBoundary)
					: null,
		};
	});
	const lastAnchor = rows.filter((row) => row.relativeDepth === 0).at(-1);
	const hasNextPage = rows[0]?.hasNextPage ?? false;
	return {
		items,
		nextCursor:
			hasNextPage && lastAnchor
				? cursorFor(input.rootPostId, parentPostId, realmId, lastAnchor)
				: null,
	};
}
