import { postApiUnitsPresentations } from "@rezics/openapi-tanstack-query";
import type { ContentLanguage } from "@rezics/i18n";
import type { UnitMentionResolver } from "@rezics/ui";

export function createUnitMentionResolver(
	localizationLanguages: readonly ContentLanguage[],
): UnitMentionResolver {
	return async (unitIds, signal) => {
		const { data } = await postApiUnitsPresentations({
			body: { ids: [...unitIds], localizationLanguages: [...localizationLanguages] },
			signal,
		});
		return data.items.map((item) => ({
			id: item.id,
			label: item.title ?? item.id,
			kind: item.kind,
			avatar: item.avatar,
		}));
	};
}
