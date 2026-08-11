"use client";

import type { ContentLanguage } from "@rezics/i18n";
import { toast } from "@rezics/ui";
import { useEffect, useRef } from "react";

import {
	useContentLanguageNavigation,
	useRequestedContentLanguage,
} from "@/features/content-languages/hooks/use-content-language-navigation";
import { useTranslation } from "./client";
import { useLocalizationLanguageState } from "./use-localization-languages";

export function useLocalizationFallbackToast(input: {
	readonly actualLanguage: ContentLanguage | null;
	readonly localizationLanguages: readonly ContentLanguage[];
	readonly unitId: string;
}) {
	const { t } = useTranslation(["ui"]);
	const localizationState = useLocalizationLanguageState();
	const requestedLanguage = useRequestedContentLanguage();
	const { replaceCurrentLanguage } = useContentLanguageNavigation();
	const preferencesReady = localizationState.status === "ready";
	const shownKey = useRef<string | undefined>(undefined);
	const localizationLanguageKey = input.localizationLanguages.join(",");
	const fallback =
		input.actualLanguage !== null &&
		(requestedLanguage
			? input.actualLanguage !== requestedLanguage
			: input.localizationLanguages.length > 0 &&
				!input.localizationLanguages.includes(input.actualLanguage));

	useEffect(() => {
		if (!preferencesReady || !fallback || !input.actualLanguage) return;
		const key = `${input.unitId}:${input.actualLanguage}:${localizationLanguageKey}`;
		let cancelled = false;
		queueMicrotask(() => {
			if (cancelled || shownKey.current === key) return;
			shownKey.current = key;
			toast.create({
				title: requestedLanguage
					? t.ui.requestedLanguageUnavailable
					: t.ui.preferredLanguageUnavailable,
				type: "info",
			});
			if (requestedLanguage) replaceCurrentLanguage(undefined);
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
		replaceCurrentLanguage,
		requestedLanguage,
		t.ui.preferredLanguageUnavailable,
		t.ui.requestedLanguageUnavailable,
	]);
}
