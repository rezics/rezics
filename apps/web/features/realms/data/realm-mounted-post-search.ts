import type { ContentLanguage } from "@rezics/i18n";
import { postApiSearchByIndex } from "@rezics/openapi-tanstack-query";
import type { EntityPickerHit } from "@rezics/ui";

type RealmMountedPostKind = "post" | "wiki";

export const RealmScoreContextPostKinds = [
	"post",
	"wiki",
] as const satisfies readonly RealmMountedPostKind[];
export const RealmTagContextPostKinds = ["wiki"] as const satisfies readonly RealmMountedPostKind[];

export async function searchRealmMountedPosts(input: {
	readonly realmId: string;
	readonly query: string;
	readonly signal: AbortSignal;
	readonly localizationLanguages: readonly ContentLanguage[];
	readonly kinds: readonly RealmMountedPostKind[];
}): Promise<readonly EntityPickerHit[]> {
	const { data } = await postApiSearchByIndex({
		path: { index: "posts" },
		body: {
			query: input.query,
			realmId: input.realmId,
			kinds: [...input.kinds],
			limit: 10,
			localizationLanguages: [...input.localizationLanguages],
		},
		signal: input.signal,
	});
	return data.hits.map((hit) => ({
		id: hit.id,
		label: hit.title ?? hit.name ?? hit.id,
		kind: hit.kind,
		avatar: hit.avatar,
	}));
}
