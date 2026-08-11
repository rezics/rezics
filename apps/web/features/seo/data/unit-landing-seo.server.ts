import { toContentLanguage } from "@rezics/i18n";
import {
	getPublicUnitSeoProjection,
	type GetPublicUnitSeoProjectionStatus200,
} from "@rezics/openapi-tanstack-query";
import { cache } from "react";

import { getTranslation } from "@/i18n/server";
import { getBackendOrigin } from "@/lib/backend-origin.server";
import { getFrontendOrigin } from "@/lib/frontend-origin.server";
import {
	buildUnitLandingSeoDocument,
	type UnitLandingSeoDocument,
	type UnitLandingSeoRoute,
} from "../model/unit-landing-seo";

const fetchPublicUnitSeoProjection = cache(
	async (
		unitId: string,
		language: ReturnType<typeof toContentLanguage>,
	): Promise<GetPublicUnitSeoProjectionStatus200 | null> => {
		try {
			const result = await getPublicUnitSeoProjection({
				baseURL: getBackendOrigin().origin,
				path: { unitId },
				query: { localizationLanguages: [language] },
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
	): Promise<UnitLandingSeoDocument> => {
		const translation = await getTranslation(["brand", "seo"]);
		const language = toContentLanguage(translation.locale.target);
		const projection = await fetchPublicUnitSeoProjection(unitId, language);
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
	);
}
