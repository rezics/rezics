"use client";

import { toContentLanguage, type ContentLanguage } from "@rezics/i18n";
import { useMemo } from "react";

import { usePresentationPreferences } from "@/features/preferences/data/use-presentation-preferences";
import { buildLocalizationLanguages } from "@/lib/localization";
import { useHydratedSession } from "@/lib/use-hydrated-session";
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
	const storedInterfaceLanguage = preferences.data
		? toContentLanguage(preferences.data.interfaceLocale)
		: undefined;
	const currentInterfaceLanguage = toContentLanguage(locale.target);
	const profileLanguages = useMemo(
		() =>
			preferences.data
				? buildLocalizationLanguages(
						preferences.data.preferredLanguages,
						storedInterfaceLanguage ?? currentInterfaceLanguage,
					)
				: undefined,
		[preferences.data, storedInterfaceLanguage, currentInterfaceLanguage],
	);
	const anonymousLanguages = useMemo(
		() => [currentInterfaceLanguage],
		[currentInterfaceLanguage],
	);

	if (session.status === "restoring") return { status: "restoring" };
	if (session.status === "error")
		return {
			status: "error",
			error: session.error,
			retry: () => void session.refetch(),
		};
	if (session.status === "anonymous")
		return { status: "ready", languages: anonymousLanguages, source: "anonymous" };
	if (profileLanguages)
		return { status: "ready", languages: profileLanguages, source: "profile" };
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

	return useMemo(
		() => (state.status === "ready" ? state.languages : [interfaceLanguage]),
		[interfaceLanguage, state],
	);
}
