"use client";

import { toContentLanguage } from "@rezics/i18n";
import { useGetApiUsersMePreferences } from "@rezics/openapi-tanstack-query";
import { useMemo } from "react";

import { buildLocalizationLanguages } from "@/lib/localization";
import { useHydratedSession } from "@/lib/use-hydrated-session";
import { useTranslation } from "./client";

export function useLocalizationLanguages() {
	const { locale } = useTranslation(["ui"]);
	const { data: session } = useHydratedSession();
	const preferences = useGetApiUsersMePreferences({
		query: { enabled: Boolean(session) },
	});
	const preferredLanguages = session ? preferences.data?.preferredLanguages : undefined;
	const interfaceLanguage = toContentLanguage(locale.target);

	return useMemo(
		() => buildLocalizationLanguages(preferredLanguages ?? [], interfaceLanguage),
		[interfaceLanguage, preferredLanguages],
	);
}
