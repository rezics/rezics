import type { GetApiPostsByPostIdRepliesStatus200 } from "@rezics/openapi-tanstack-query";

type ApiReplyPost = GetApiPostsByPostIdRepliesStatus200["items"][number];

export type ReplyPostTreeNode = ApiReplyPost & {
	children: ReplyPostTreeNode[];
};

/** Keep every reply renderable even if stored parent links are incomplete. */
export function buildReplyPostTree(replies: readonly ApiReplyPost[]): ReplyPostTreeNode[] {
	const nodes = new Map<string, ReplyPostTreeNode>();
	for (const reply of replies) nodes.set(reply.id, { ...reply, children: [] });
	const roots: ReplyPostTreeNode[] = [];

	for (const reply of replies) {
		const node = nodes.get(reply.id);
		if (!node) continue;
		const parent = reply.parentPostId ? nodes.get(reply.parentPostId) : undefined;
		if (!parent || wouldCreateCycle(reply.id, reply.parentPostId, nodes)) {
			roots.push(node);
			continue;
		}
		parent.children.push(node);
	}

	return roots;
}

export function findReplyPost(
	nodes: readonly ReplyPostTreeNode[],
	postId: string,
): ReplyPostTreeNode | undefined {
	for (const node of nodes) {
		if (node.id === postId) return node;
		const nested = findReplyPost(node.children, postId);
		if (nested) return nested;
	}
	return undefined;
}

function wouldCreateCycle(
	childId: string,
	parentPostId: string | null,
	nodes: ReadonlyMap<string, ReplyPostTreeNode>,
) {
	const visited = new Set<string>();
	let ancestorId = parentPostId;
	while (ancestorId) {
		if (ancestorId === childId || visited.has(ancestorId)) return true;
		visited.add(ancestorId);
		ancestorId = nodes.get(ancestorId)?.parentPostId ?? null;
	}
	return false;
}
