"use client";

import { toContentLanguage } from "@rezics/i18n";
import {
	useGetApiRealmsByRealmId,
	useGetApiUsersMePreferences,
} from "@rezics/openapi-tanstack-query";
import { OfficialRealmUnitIds } from "@rezics/slug";

import { useTranslation } from "@/i18n/client";
import type { ResourceVisibility } from "@/features/privacy/model/resource-visibility";
import { buildLocalizationLanguages, selectLocalization } from "@/lib/localization";
import { useHydratedSession } from "@/lib/use-hydrated-session";

export interface ScoreContextSelection {
	readonly id: string;
	readonly label: string;
}

export function useDefaultScoreContext() {
	const session = useHydratedSession();
	const preferences = useGetApiUsersMePreferences({
		query: { enabled: !session.isPending && Boolean(session.data) },
	});
	const contextUnitId = preferences.data?.defaultScoreContextUnitId ?? OfficialRealmUnitIds.score;
	const { locale } = useTranslation(["ui"]);
	const localizationLanguages = buildLocalizationLanguages(
		preferences.data?.preferredLanguages ?? [],
		toContentLanguage(locale.target),
	);
	const realm = useGetApiRealmsByRealmId(
		{ path: { realmId: contextUnitId }, query: { localizationLanguages } },
		{
			query: {
				enabled: !session.isPending && (!session.data || !preferences.isPending),
			},
		},
	);
	const localization = realm.data
		? selectLocalization(realm.data.localizations, realm.data.language, realm.data.language)
		: undefined;
	const selection = realm.data
		? {
				id: realm.data.id,
				label: localization?.title ?? realm.data.id,
			}
		: undefined;

	return {
		context: selection,
		visibility: (preferences.data?.scoreVisibility ?? "private") satisfies ResourceVisibility,
		error: realm.error,
		isPending:
			session.isPending ||
			(Boolean(session.data) && preferences.isPending) ||
			realm.isPending,
	};
}
