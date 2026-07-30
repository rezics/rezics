"use client";

import type { ContentLanguage } from "@rezics/i18n";
import type { ReactNode } from "react";

import { useChineseContentText } from "@/features/content-language-display/chinese-content-display-context";
import type { CatalogDetailUnitType } from "@/features/units/model/catalog-detail-section";
import type { TagPresentation } from "../model/tag-presentation";
import { TagBadgeCard } from "./tag-badge-card";

export function TagContextSection({
	description,
	descriptionLanguage,
	empty,
	fallbackLabel,
	heading,
	headingLevel = "h3",
	items,
	pendingItemKey,
	selectedTagIds,
	selectionMode,
	title,
	titleLanguage,
	type,
	onClearVote,
	onToggleSelected,
	onVote,
}: {
	readonly description?: string | null;
	readonly descriptionLanguage?: ContentLanguage | null;
	readonly empty: string;
	readonly fallbackLabel: string;
	readonly heading?: ReactNode;
	readonly headingLevel?: "h2" | "h3" | "h4";
	readonly items: readonly TagPresentation[];
	readonly pendingItemKey?: string;
	readonly selectedTagIds: ReadonlySet<string>;
	readonly selectionMode: boolean;
	readonly title: string;
	readonly titleLanguage?: ContentLanguage | null;
	readonly type: CatalogDetailUnitType;
	readonly onClearVote: (item: TagPresentation) => void;
	readonly onToggleSelected: (tagId: string, label: string) => void;
	readonly onVote: (item: TagPresentation, value: -1 | 1) => void;
}) {
	const Heading = headingLevel;
	const displayedTitle = useChineseContentText(title, titleLanguage);
	const displayedDescription = useChineseContentText(description ?? "", descriptionLanguage);
	return (
		<section className="grid gap-3">
			<div className="grid gap-1">
				<Heading className="min-w-0 font-semibold">{heading ?? displayedTitle}</Heading>
				{displayedDescription ? (
					<p className="text-sm leading-6 text-muted-foreground">
						{displayedDescription}
					</p>
				) : null}
			</div>
			{items.length ? (
				<div className="flex flex-wrap gap-2">
					{items.map((item) => (
						<TagBadgeCard
							fallbackLabel={fallbackLabel}
							isPending={pendingItemKey === item.itemKey}
							item={item}
							key={item.itemKey}
							onClearVote={onClearVote}
							onToggleSelected={onToggleSelected}
							onVote={onVote}
							selected={selectedTagIds.has(item.identity.tagId)}
							selectionMode={selectionMode}
							type={type}
						/>
					))}
				</div>
			) : (
				<p className="text-sm text-muted-foreground">{empty}</p>
			)}
		</section>
	);
}
