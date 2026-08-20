"use client";

import { Badge } from "@rezics/ui";

import { useTranslation } from "@/i18n/client";
import { createContentLanguageSupportDraft } from "../model/content-language-support";

export function ContentLanguageSupportDisplay({ value }: { readonly value: unknown }) {
	const { t } = useTranslation(["units"]);
	const entries = createContentLanguageSupportDraft(value);

	return (
		<div className="grid gap-3 text-sm">
			{entries.map((entry) => (
				<div className="grid gap-1" key={entry.languageTag}>
					<Badge className="w-fit" variant="outline">
						{entry.languageTag}
					</Badge>
					<p className="text-muted-foreground">
						{entry.channels
							? entry.channels
									.map((channel) => t.units.contentLanguageSupport.channels[channel])
									.join(", ")
							: t.units.contentLanguageSupport.unqualifiedChannels}
					</p>
				</div>
			))}
		</div>
	);
}
