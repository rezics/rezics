import { postApiSearchByIndex } from "@rezics/openapi-tanstack-query";
import type { EntityPickerHit } from "@rezics/ui";

export const RealmScoreContextPostKinds = ["post", "wiki"] as const;

export async function searchRealmScoreContextPosts(
	realmId: string,
	query: string,
	signal: AbortSignal,
): Promise<readonly EntityPickerHit[]> {
	const { data } = await postApiSearchByIndex({
		path: { index: "posts" },
		body: {
			query,
			realmId,
			kinds: [...RealmScoreContextPostKinds],
			limit: 10,
		},
		signal,
	});
	return data.hits.map((hit) => ({
		id: hit.id,
		label: hit.titles[0] ?? hit.name ?? hit.id,
		kind: hit.kind,
		avatar: hit.avatar,
	}));
}
