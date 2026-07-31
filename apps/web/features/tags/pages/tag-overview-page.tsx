"use client";

import { LocalizedPortableTextContent } from "@/features/content-language-display/localized-portable-text-content";
import { useTranslation } from "@/i18n/client";
import { readPortableText } from "@/lib/block";
import { selectLocalization } from "@/lib/localization";
import { TagDetailSectionFrame } from "../components/tag-detail-section-frame";
import { useTagDetail } from "../components/tag-detail-workspace";

export function TagOverviewPage() {
	const tag = useTagDetail();
	const { t } = useTranslation(["tags"]);
	const localization = selectLocalization(tag.localizations, tag.language);
	return (
		<TagDetailSectionFrame
			description={t.tags.detail.overviewDescription}
			title={t.tags.detail.overviewTitle}
		>
			{localization?.description ? (
				<div className="prose max-w-none">
					<LocalizedPortableTextContent
						language={localization.language}
						value={readPortableText(localization.description)}
						variant="article"
					/>
				</div>
			) : (
				<p className="text-sm text-muted-foreground">{t.tags.detail.bodyEmpty}</p>
			)}
		</TagDetailSectionFrame>
	);
}
