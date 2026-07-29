import type { PostApiFeedQueryStatus200 } from "@rezics/openapi-tanstack-query";

export type PostRealmContext = PostApiFeedQueryStatus200["items"][number]["realms"][number];

export function selectPostRealmContext(
	realms: readonly PostRealmContext[],
	requestedRealmId?: string,
): PostRealmContext | undefined {
	return requestedRealmId ? realms.find((realm) => realm.id === requestedRealmId) : undefined;
}
