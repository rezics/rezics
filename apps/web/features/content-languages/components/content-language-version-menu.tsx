"use client";

import { isContentLanguage } from "@rezics/i18n";
import { canonicalizeContentLanguageTag } from "@rezics/content-language";
import { useMemo } from "react";
import { MenuRadioGroup, MenuRadioItem, MenuSub, MenuSubContent, MenuSubTrigger } from "@rezics/ui";
import { LanguagesIcon } from "lucide-react";

import { useTranslation } from "@/i18n/client";
import {
	useContentLanguageNavigation,
	useRequestedContentLanguage,
} from "../hooks/use-content-language-navigation";

export function ContentLanguageVersionMenu({
	availableLanguages,
	baseHref,
	currentLanguage,
}: {
	readonly availableLanguages: readonly string[];
	/** When provided, selecting a version pushes this item route; otherwise it replaces this page. */
	readonly baseHref?: string;
	readonly currentLanguage: string | null;
}) {
	const { t, locale } = useTranslation(["locale"]);
	const names = useMemo(
		() => new Intl.DisplayNames([locale.current], { type: "language" }),
		[locale.current],
	);
	const requestedLanguage = useRequestedContentLanguage();
	const { pushLanguage, replaceCurrentLanguage } = useContentLanguageNavigation();
	const selectedValue = baseHref
		? (currentLanguage ?? "automatic")
		: (requestedLanguage ?? "automatic");
	const selectLanguage = (language: string | undefined) => {
		if (baseHref) pushLanguage(baseHref, language);
		else replaceCurrentLanguage(language);
	};

	return (
		<MenuSub>
			<MenuSubTrigger>
				<LanguagesIcon aria-hidden />
				{t.locale.contentVersions.action}
			</MenuSubTrigger>
			<MenuSubContent>
				<MenuRadioGroup
					onValueChange={({ value }) => {
						if (value === "automatic") selectLanguage(undefined);
						else if (availableLanguages.includes(value)) {
							try {
								selectLanguage(canonicalizeContentLanguageTag(value));
							} catch {
								/* Reject an invalid external language tag. */
							}
						}
					}}
					value={selectedValue}
				>
					<MenuRadioItem value="automatic">{t.locale.contentVersions.automatic}</MenuRadioItem>
					{availableLanguages.map((language) => (
						<MenuRadioItem key={language} value={language}>
							{isContentLanguage(language)
								? t.locale.contentLanguages[language]
								: (names.of(language) ?? language)}
						</MenuRadioItem>
					))}
				</MenuRadioGroup>
			</MenuSubContent>
		</MenuSub>
	);
}
