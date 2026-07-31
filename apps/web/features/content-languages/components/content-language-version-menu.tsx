"use client";

import { isContentLanguage, type ContentLanguage } from "@rezics/i18n";
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
	readonly availableLanguages: readonly ContentLanguage[];
	/** When provided, selecting a version pushes this item route; otherwise it replaces this page. */
	readonly baseHref?: string;
	readonly currentLanguage: ContentLanguage | null;
}) {
	const { t } = useTranslation(["locale"]);
	const requestedLanguage = useRequestedContentLanguage();
	const { pushLanguage, replaceCurrentLanguage } = useContentLanguageNavigation();
	const selectedValue = baseHref
		? (currentLanguage ?? "automatic")
		: (requestedLanguage ?? "automatic");
	const selectLanguage = (language: ContentLanguage | undefined) => {
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
						else if (isContentLanguage(value)) selectLanguage(value);
					}}
					value={selectedValue}
				>
					<MenuRadioItem value="automatic">
						{t.locale.contentVersions.automatic}
					</MenuRadioItem>
					{availableLanguages.map((language) => (
						<MenuRadioItem key={language} value={language}>
							{t.locale.contentLanguages[language]}
						</MenuRadioItem>
					))}
				</MenuRadioGroup>
			</MenuSubContent>
		</MenuSub>
	);
}
