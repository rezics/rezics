"use client";

import type { SearchInjection } from "@rezics/filter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@rezics/ui";
import { useMemo, useState } from "react";

import { SearchSurface, type SearchSurfaceSource } from "@/features/search/search-page";
import { useTranslation } from "@/i18n/client";
import { selectLocalization } from "@/lib/localization";
import { TagDetailSectionFrame } from "../components/tag-detail-section-frame";
import { useTagDetail } from "../components/tag-detail-workspace";

export function TagContentPage() {
	const tag = useTagDetail();
	const { t } = useTranslation(["tags"]);
	const localization = selectLocalization(tag.localizations, tag.language);
	const label = localization?.title ?? t.tags.unnamedTag;
	const [mode, setMode] = useState<"direct" | "semantic">("direct");
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
	const directSource = useMemo<SearchSurfaceSource>(
		() => ({
			kind: "filter",
			filterDocument: {
				where: {
					tags: {
						some: {
							tag: { id: { in: [tag.id] } },
							authority: { kind: "global", view: { kind: "direct" } },
						},
					},
				},
			},
		}),
		[tag.id],
	);
	const semanticSource = useMemo<SearchSurfaceSource>(
		() => ({ kind: "filter", filterDocument: {} }),
		[],
	);
	return (
		<TagDetailSectionFrame
			description={t.tags.detail.contentDescription}
			title={t.tags.detail.contentTitle}
		>
			<Tabs
				onValueChange={({ value }) => {
					if (value === "direct" || value === "semantic") setMode(value);
				}}
				value={mode}
			>
				<TabsList aria-label={t.tags.detail.contentTitle} variant="underline">
					<TabsTrigger value="direct">{t.tags.semantics.directUsagesTitle}</TabsTrigger>
					<TabsTrigger value="semantic">{t.tags.semantics.semanticReachTitle}</TabsTrigger>
				</TabsList>
				<TabsContent className="grid gap-4 pt-5" value="direct">
					<p className="text-sm text-muted-foreground">
						{t.tags.semantics.directUsagesDescription}
					</p>
					<SearchSurface
						id={`tag-direct-content-${tag.id}`}
						injections={injections}
						resolveOptionLabel={(control, value) =>
							control.field === "tag" && value === tag.id ? label : undefined
						}
						source={directSource}
					/>
				</TabsContent>
				<TabsContent className="grid gap-4 pt-5" value="semantic">
					<p className="text-sm text-muted-foreground">
						{t.tags.semantics.semanticReachDescription}
					</p>
					<SearchSurface
						id={`tag-semantic-content-${tag.id}`}
						injections={injections}
						resolveOptionLabel={(control, value) =>
							control.field === "tag" && value === tag.id ? label : undefined
						}
						source={semanticSource}
					/>
				</TabsContent>
			</Tabs>
		</TagDetailSectionFrame>
	);
}
