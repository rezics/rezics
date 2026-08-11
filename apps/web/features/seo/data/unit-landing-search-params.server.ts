import type { ContentLanguage } from "@rezics/i18n";
import { createSearchParamsCache } from "nuqs/server";

import { searchParamsParsers } from "@/lib/search-params";

const unitLandingSearchParams = createSearchParamsCache({
	language: searchParamsParsers.language,
});

export type UnitLandingSearchParams = Promise<{
	readonly language?: string | string[];
}>;

export async function getRequestedUnitLandingLanguage(
	searchParams: UnitLandingSearchParams,
): Promise<ContentLanguage | undefined> {
	const { language } = await unitLandingSearchParams.parse(searchParams);
	return language ?? undefined;
}
