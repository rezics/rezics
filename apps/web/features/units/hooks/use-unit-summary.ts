"use client";
import type { UnitReference } from "@rezics/reference";
import { postApiUnitsPresentations } from "@rezics/openapi-tanstack-query";
import { useQuery } from "@tanstack/react-query";
import { useLocalizationLanguages } from "@/i18n/use-localization-languages";
class UnavailableUnitSummary extends Error {
	readonly code = "UnitNotFound";
}
/** Shared names and imagery remain bound to the requested native owner and immutable identity. */
export function useUnitSummary(reference: UnitReference) {
	const languages = useLocalizationLanguages();
	return useQuery({
		queryKey: ["unit-summary", reference.owner, reference.id, ...languages],
		queryFn: async ({ signal }) => {
			const { data } = await postApiUnitsPresentations({
				body: { ids: [reference.id], localizationLanguages: languages },
				signal,
				throwOnError: true,
			});
			const item = data.items.find(
				(item) => item.id === reference.id && item.owner === reference.owner,
			);
			if (!item) throw new UnavailableUnitSummary();
			return item;
		},
	});
}
