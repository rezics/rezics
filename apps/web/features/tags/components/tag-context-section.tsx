"use client";

import type { CatalogDetailUnitType } from "@/features/units/model/catalog-detail-section";
import type { TagPresentation } from "../model/tag-presentation";
import { TagBadgeCard } from "./tag-badge-card";

export function TagContextSection({
	description,
	empty,
	fallbackLabel,
	headingLevel = "h3",
	items,
	pendingItemKey,
	selectedTagIds,
	selectionMode,
	title,
	type,
	onClearVote,
	onToggleSelected,
	onVote,
}: {
	readonly description?: string | null;
	readonly empty: string;
	readonly fallbackLabel: string;
	readonly headingLevel?: "h2" | "h3" | "h4";
	readonly items: readonly TagPresentation[];
	readonly pendingItemKey?: string;
	readonly selectedTagIds: ReadonlySet<string>;
	readonly selectionMode: boolean;
	readonly title: string;
	readonly type: CatalogDetailUnitType;
	readonly onClearVote: (item: TagPresentation) => void;
	readonly onToggleSelected: (tagId: string) => void;
	readonly onVote: (item: TagPresentation, value: -1 | 1) => void;
}) {
	const Heading = headingLevel;
	return (
		<section className="grid gap-3">
			<div className="grid gap-1">
				<Heading className="font-semibold">{title}</Heading>
				{description ? (
					<p className="text-sm leading-6 text-muted-foreground">{description}</p>
				) : null}
			</div>
			{items.length ? (
				<div className="flex flex-wrap gap-2">
					{items.map((item) => (
						<TagBadgeCard
							isPending={pendingItemKey === item.itemKey}
							item={item}
							key={item.itemKey}
							label={item.identity.title ?? fallbackLabel}
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
