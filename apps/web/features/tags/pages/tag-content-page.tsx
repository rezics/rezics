"use client";

import type { SearchInjection } from "@rezics/filter";
import { useMemo } from "react";

import { SearchSurface } from "@/features/search/search-page";
import { useTranslation } from "@/i18n/client";
import { selectLocalization } from "@/lib/localization";
import { TagDetailSectionFrame } from "../components/tag-detail-section-frame";
import { useTagDetail } from "../components/tag-detail-workspace";

export function TagContentPage() {
	const tag = useTagDetail();
	const { t } = useTranslation(["tags"]);
	const localization = selectLocalization(tag.localizations, tag.language);
	const label = localization?.title ?? t.tags.unnamedTag;
	const injections = useMemo<SearchInjection[]>(
		() => [
			{
				source: "tag",
				removable: false,
				value: {
					controlKey: "tag",
					filter: { field: "tag", operator: "equals", value: tag.id },
				},
			},
		],
		[tag.id],
	);
	return (
		<TagDetailSectionFrame
			description={t.tags.detail.contentDescription}
			title={t.tags.detail.contentTitle}
		>
			<SearchSurface
				id={`tag-content-${tag.id}`}
				injections={injections}
				resolveOptionLabel={(control, value) =>
					control.field === "tag" && value === tag.id ? label : undefined
				}
				source={{ kind: "template", template: "global" }}
			/>
		</TagDetailSectionFrame>
	);
}
