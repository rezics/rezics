import { postApiUnitsPresentations } from "@rezics/openapi-tanstack-query";
import type { UnitMentionResolver } from "@rezics/ui";

export const resolveUnitMentions: UnitMentionResolver = async (unitIds, signal) => {
	const { data } = await postApiUnitsPresentations({
		body: { ids: [...unitIds] },
		signal,
	});
	return data.items.map((item) => ({
		id: item.id,
		label: item.title ?? item.id,
		kind: item.kind,
		avatar: item.avatar,
	}));
};
