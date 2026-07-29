import type { PostApiFeedQueryStatus200 } from "@rezics/openapi-tanstack-query";

export type PostRealmContext = PostApiFeedQueryStatus200["items"][number]["realms"][number];

export type PostRealmContextSelection =
	{ readonly kind: "global" } | { readonly kind: "realm"; readonly realm: PostRealmContext };

const GlobalPostRealmContextSelection = {
	kind: "global",
} as const satisfies PostRealmContextSelection;

export function resolvePostRealmContext(
	realms: readonly PostRealmContext[],
	requestedRealmId?: string,
): PostRealmContextSelection {
	if (!requestedRealmId) return GlobalPostRealmContextSelection;
	const realm = realms.find((candidate) => candidate.id === requestedRealmId);
	return realm ? { kind: "realm", realm } : GlobalPostRealmContextSelection;
}
