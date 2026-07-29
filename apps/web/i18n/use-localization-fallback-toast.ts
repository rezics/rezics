"use client";

import type { ContentLanguage } from "@rezics/i18n";
import { useGetApiUsersMePreferences } from "@rezics/openapi-tanstack-query";
import { toast } from "@rezics/ui";
import { useEffect, useRef } from "react";

import { useHydratedSession } from "@/lib/use-hydrated-session";
import { useTranslation } from "./client";

export function useLocalizationFallbackToast(input: {
	readonly actualLanguage: ContentLanguage | null;
	readonly localizationLanguages: readonly ContentLanguage[];
	readonly unitId: string;
}) {
	const { t } = useTranslation(["ui"]);
	const session = useHydratedSession();
	const preferences = useGetApiUsersMePreferences({
		query: { enabled: Boolean(session.data) },
	});
	const preferencesReady = !session.isPending && (!session.data || Boolean(preferences.data));
	const shownKey = useRef<string | undefined>(undefined);
	const localizationLanguageKey = input.localizationLanguages.join(",");
	const fallback =
		input.actualLanguage !== null &&
		!input.localizationLanguages.includes(input.actualLanguage);

	useEffect(() => {
		if (!preferencesReady || !fallback || !input.actualLanguage) return;
		const key = `${input.unitId}:${input.actualLanguage}:${localizationLanguageKey}`;
		let cancelled = false;
		queueMicrotask(() => {
			if (cancelled || shownKey.current === key) return;
			shownKey.current = key;
			toast.create({
				title: t.ui.preferredLanguageUnavailable,
				type: "info",
			});
		});
		return () => {
			cancelled = true;
		};
	}, [
		fallback,
		input.actualLanguage,
		input.unitId,
		localizationLanguageKey,
		preferencesReady,
		t.ui.preferredLanguageUnavailable,
	]);
}
