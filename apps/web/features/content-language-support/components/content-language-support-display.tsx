"use client";

import { Badge } from "@rezics/ui";

import { AppLink } from "@/features/application-shell/components/app-link";
import { useTranslation } from "@/i18n/client";
import {
	createContentLanguageSupportDraft,
	type ContentLanguageSupportUnitType,
} from "../model/content-language-support";
import {
	formatContentLanguageName,
	groupContentLanguageSupport,
} from "../model/content-language-presentation";
import { contentLanguageSearchHref } from "../routing/content-language-search-route";

export function ContentLanguageSupportDisplay({
	value,
	searchUnitType,
}: {
	readonly value: unknown;
	readonly searchUnitType?: ContentLanguageSupportUnitType;
}) {
	const { locale, t } = useTranslation(["units"]);
	const entries = createContentLanguageSupportDraft(value);
	const groups = groupContentLanguageSupport(entries);

	return (
		<div className="grid gap-4 text-sm">
			{groups.map((group) => (
				<section className="grid gap-2" key={group.channel ?? "unqualified"}>
					<div className="flex items-center gap-2">
						<h3 className="font-medium">
							{group.channel
								? t.units.contentLanguageSupport.channels[group.channel]
								: t.units.contentLanguageSupport.unqualifiedChannels}
						</h3>
						<Badge variant="secondary">
							{group.languageTags.length.toLocaleString(locale.current)}
						</Badge>
					</div>
					<ul className="flex flex-wrap gap-2">
						{group.languageTags.map((languageTag) => {
							const name = formatContentLanguageName(locale.current, languageTag);
							const badge = (
								<Badge className="w-fit" variant="outline">
									{name}
								</Badge>
							);
							return (
								<li key={languageTag}>
									{searchUnitType ? (
										<AppLink
											className="rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
											href={contentLanguageSearchHref({
												unitType: searchUnitType,
												languageTag,
												...(group.channel ? { channel: group.channel } : {}),
											})}
										>
											{badge}
										</AppLink>
									) : (
										badge
									)}
								</li>
							);
						})}
					</ul>
				</section>
			))}
		</div>
	);
}
