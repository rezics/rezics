import { canonicalizeContentLanguageTag, type ContentLanguageTag } from "@rezics/content-language";
import { createParser, createSearchParamsCache } from "nuqs/server";
const unitLandingSearchParams = createSearchParamsCache({
	language: createParser({
		parse(value) {
			try {
				return canonicalizeContentLanguageTag(value);
			} catch {
				return null;
			}
		},
		serialize: String,
	}),
});
export type UnitLandingSearchParams = Promise<{ readonly language?: string | string[] }>;
export async function getRequestedUnitLandingLanguage(
	searchParams: UnitLandingSearchParams,
): Promise<ContentLanguageTag | undefined> {
	const { language } = await unitLandingSearchParams.parse(searchParams);
	return language ?? undefined;
}
