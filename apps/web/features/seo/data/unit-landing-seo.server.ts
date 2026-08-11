import { toContentLanguage, type ContentLanguage } from "@rezics/i18n";
import {
	getPublicUnitSeoProjection,
	type GetPublicUnitSeoProjectionStatus200,
} from "@rezics/openapi-tanstack-query";
import { cache } from "react";
import { headers } from "next/headers";

import { getInitialPresentationPreferences } from "@/features/preferences/server/initial-presentation-preferences.server";
import { getTranslation } from "@/i18n/server";
import { getBackendOrigin } from "@/lib/backend-origin.server";
import { getFrontendOrigin } from "@/lib/frontend-origin.server";
import {
	buildUnitLandingSeoDocument,
	type UnitLandingSeoDocument,
	type UnitLandingSeoRoute,
} from "../model/unit-landing-seo";
import { buildUnitLandingLocalizationLanguages } from "../model/unit-landing-language-order";

const getUnitLandingProfileLanguagePreferences = cache(async () => {
	const preferences = await getInitialPresentationPreferences(await headers());
	return preferences.status === "resolved"
		? {
				preferredLanguages: preferences.data.preferredLanguages,
				interfaceLanguage: toContentLanguage(preferences.data.interfaceLocale),
			}
		: undefined;
});

const fetchPublicUnitSeoProjection = cache(
	async (
		unitId: string,
		localizationLanguages: readonly ContentLanguage[],
	): Promise<GetPublicUnitSeoProjectionStatus200 | null> => {
		try {
			const query = localizationLanguages.length
				? { localizationLanguages: [...localizationLanguages] }
				: {};
			const result = await getPublicUnitSeoProjection({
				baseURL: getBackendOrigin().origin,
				path: { unitId },
				query,
				throwOnError: false,
				options: { cache: "no-store" },
			});
			return result.status === 200 ? result.data : null;
		} catch {
			return null;
		}
	},
);

const getCachedUnitLandingSeoDocument = cache(
	async (
		unitId: string,
		expectedKind: UnitLandingSeoRoute["expectedKind"],
		canonicalPath: string,
		parentCanonicalPath: string | undefined,
		requestedLanguage: UnitLandingSeoRoute["requestedLanguage"],
	): Promise<UnitLandingSeoDocument> => {
		const translation = await getTranslation(["brand", "seo"]);
		const profile = await getUnitLandingProfileLanguagePreferences();
		const localizationLanguages = buildUnitLandingLocalizationLanguages({
			requestedLanguage,
			profile,
		});
		const projection = await fetchPublicUnitSeoProjection(unitId, localizationLanguages);
		return buildUnitLandingSeoDocument({
			unitId,
			expectedKind,
			canonicalPath,
			parentCanonicalPath,
			projection,
			frontendOrigin: getFrontendOrigin(),
			t: translation.t,
		});
	},
);

export function getUnitLandingSeoDocument(
	route: UnitLandingSeoRoute,
): Promise<UnitLandingSeoDocument> {
	return getCachedUnitLandingSeoDocument(
		route.unitId,
		route.expectedKind,
		route.canonicalPath,
		route.parentCanonicalPath,
		route.requestedLanguage,
	);
}
