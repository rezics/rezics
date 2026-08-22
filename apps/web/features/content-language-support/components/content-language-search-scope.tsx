"use client";

import type { ContentLanguageChannel, ContentLanguageTag } from "@rezics/content-language";
import { Badge } from "@rezics/ui";

import { useTranslation } from "@/i18n/client";
import { formatContentLanguageName } from "../model/content-language-presentation";
import type { ContentLanguageSearchContentKindValues } from "../routing/content-language-search-route";

export function ContentLanguageSearchScope({
	channel,
	content,
	languageTag,
}: {
	readonly channel?: ContentLanguageChannel;
	readonly content: (typeof ContentLanguageSearchContentKindValues)[number];
	readonly languageTag: ContentLanguageTag;
}) {
	const { locale, t } = useTranslation(["feed", "units"]);
	return (
		<>
			<Badge variant="secondary">{t.feed.content.kinds[content]}</Badge>
			{channel ? (
				<Badge variant="secondary">{t.units.contentLanguageSupport.channels[channel]}</Badge>
			) : null}
			<Badge variant="secondary">{formatContentLanguageName(locale.current, languageTag)}</Badge>
		</>
	);
}
