"use client";

import { useMemo } from "react";

import { SearchFeatureFeed } from "@/features/content-feed/components/search-feature-feed";
import { useTranslation } from "@/i18n/client";
import { createEntityRelatedContentRequest } from "../model/entity-related-content";

export function EntityRelatedFeed({ entityId }: { readonly entityId: string }) {
	const { t } = useTranslation(["entities"]);
	const request = useMemo(() => createEntityRelatedContentRequest(entityId), [entityId]);

	return (
		<section className="grid scroll-mt-20 gap-4" id="related-content">
			<div className="grid gap-1">
				<h2 className="font-heading text-xl font-bold">{t.entities.relatedContentTitle}</h2>
				<p className="text-sm text-muted-foreground">{t.entities.relatedContentDescription}</p>
			</div>
			<SearchFeatureFeed
				aria-label={t.entities.relatedContentTitle}
				displayContext={{ kind: "unit", unitId: entityId }}
				emptyBody={t.entities.relatedContentEmptyDescription}
				emptyTitle={t.entities.relatedContentEmptyTitle}
				initialRequest={request}
				template="global"
			/>
		</section>
	);
}
