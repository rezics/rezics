"use client";

import { toContentLanguage, type ContentLanguage } from "@rezics/i18n";
import { useMemo } from "react";

import { useRequestedContentLanguage } from "@/features/content-languages/hooks/use-content-language-navigation";
import { usePresentationPreferences } from "@/features/preferences/data/use-presentation-preferences";
import { buildLocalizationLanguages } from "@/lib/localization";
import { useHydratedSession } from "@/lib/use-hydrated-session";
import { useBrowserContentLanguages } from "./browser-content-languages";
import { useTranslation } from "./client";

export type LocalizationLanguageState =
	| { readonly status: "restoring" }
	| {
			readonly status: "ready";
			readonly languages: ContentLanguage[];
			readonly source: "anonymous" | "profile";
	  }
	| { readonly status: "error"; readonly error: unknown; readonly retry: () => void };

export function useLocalizationLanguageState(): LocalizationLanguageState {
	const { locale } = useTranslation(["ui"]);
	const session = useHydratedSession();
	const preferences = usePresentationPreferences();
	const browserContentLanguages = useBrowserContentLanguages();
	const storedInterfaceLanguage = preferences.data
		? toContentLanguage(preferences.data.interfaceLocale)
		: undefined;
	const currentInterfaceLanguage = toContentLanguage(locale.target);
	const anonymousLanguages = useMemo(
		() => buildLocalizationLanguages([], currentInterfaceLanguage, browserContentLanguages),
		[browserContentLanguages, currentInterfaceLanguage],
	);
	const profileLanguages = useMemo(
		() =>
			preferences.data
				? buildLocalizationLanguages(
						preferences.data.preferredLanguages,
						storedInterfaceLanguage ?? currentInterfaceLanguage,
						browserContentLanguages,
					)
				: undefined,
		[browserContentLanguages, currentInterfaceLanguage, preferences.data, storedInterfaceLanguage],
	);
	if (session.status === "restoring") return { status: "restoring" };
	if (session.status === "error")
		return {
			status: "error",
			error: session.error,
			retry: () => void session.refetch(),
		};
	if (session.status === "anonymous")
		return {
			status: "ready",
			languages: anonymousLanguages,
			source: "anonymous",
		};
	if (profileLanguages) return { status: "ready", languages: profileLanguages, source: "profile" };
	if (preferences.isError)
		return {
			status: "error",
			error: preferences.error,
			retry: () => void preferences.refetch(),
		};
	return { status: "restoring" };
}

export function useLocalizationLanguages() {
	const { locale } = useTranslation(["ui"]);
	const state = useLocalizationLanguageState();
	const interfaceLanguage = toContentLanguage(locale.target);
	const browserContentLanguages = useBrowserContentLanguages();
	const requestedLanguage = useRequestedContentLanguage();
	const interfaceLanguages = useMemo(
		() => buildLocalizationLanguages([], interfaceLanguage, browserContentLanguages),
		[browserContentLanguages, interfaceLanguage],
	);

	return useMemo(() => {
		const languages = state.status === "ready" ? state.languages : interfaceLanguages;
		return requestedLanguage
			? [requestedLanguage, ...languages.filter((language) => language !== requestedLanguage)]
			: languages;
	}, [interfaceLanguages, requestedLanguage, state]);
}
