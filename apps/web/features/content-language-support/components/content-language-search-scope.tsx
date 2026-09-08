"use client";

import type { ContentLanguageChannel, ContentLanguageTag } from "@rezics/content-language";
import { Badge } from "@rezics/ui";
import { isSimpleFeedContentKind } from "@rezics/filter";

import { useTranslation } from "@/i18n/client";
import { formatContentLanguageName } from "../model/content-language-presentation";
import type { ContentLanguageSupportOwner } from "../model/content-language-support";

export function ContentLanguageSearchScope({
	channel,
	owner,
	shape,
	languageTag,
}: {
	readonly channel?: ContentLanguageChannel;
	readonly owner: ContentLanguageSupportOwner;
	readonly shape?: string;
	readonly languageTag: ContentLanguageTag;
}) {
	const { locale, t } = useTranslation(["feed", "units"]);
	const token = shape ? `${owner}:${shape}` : undefined;
	const label =
		token && isSimpleFeedContentKind(token)
			? t.feed.content.kinds[token]
			: t.feed.content.owners[owner];
	return (
		<>
			<Badge variant="secondary">{label}</Badge>
			{channel ? (
				<Badge variant="secondary">{t.units.contentLanguageSupport.channels[channel]}</Badge>
			) : null}
			<Badge variant="secondary">{formatContentLanguageName(locale.current, languageTag)}</Badge>
		</>
	);
}
