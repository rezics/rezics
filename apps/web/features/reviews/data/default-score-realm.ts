"use client";

import { toContentLanguage } from "@rezics/i18n";
import {
	useGetApiRealmsByRealmId,
	useGetApiUsersMePreferences,
} from "@rezics/openapi-tanstack-query";
import { OfficialRealmUnitIds } from "@rezics/slug";

import { useTranslation } from "@/i18n/client";
import { selectLocalization } from "@/lib/localization";
import { useHydratedSession } from "@/lib/use-hydrated-session";

export interface ScoreRealmSelection {
	readonly id: string;
	readonly label: string;
}

export function useDefaultScoreRealm() {
	const session = useHydratedSession();
	const preferences = useGetApiUsersMePreferences({
		query: { enabled: !session.isPending && Boolean(session.data) },
	});
	const realmId = preferences.data?.defaultScoreRealmId ?? OfficialRealmUnitIds.score;
	const realm = useGetApiRealmsByRealmId(
		{ path: { realmId } },
		{
			query: {
				enabled: !session.isPending && (!session.data || !preferences.isPending),
			},
		},
	);
	const { locale } = useTranslation(["ui"]);
	const localization = realm.data
		? selectLocalization(
				realm.data.localizations,
				toContentLanguage(locale.target),
				realm.data.language,
			)
		: undefined;
	const selection = realm.data
		? {
				id: realm.data.id,
				label: localization?.title ?? realm.data.id,
			}
		: undefined;

	return {
		realm: selection,
		error: realm.error,
		isPending:
			session.isPending ||
			(Boolean(session.data) && preferences.isPending) ||
			realm.isPending,
	};
}
