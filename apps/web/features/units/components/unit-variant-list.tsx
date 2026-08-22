"use client";

import { useChineseContentText } from "@/features/content-language-display/chinese-content-display-context";
import { FeedCard } from "@/features/content-feed/components/feed-card";
import { FeedOverflowMenu } from "@/features/content-feed/components/feed-card-actions";
import { FeedList } from "@/features/content-feed/components/feed-list";
import { FeedUnitContent } from "@/features/content-feed/components/feed-unit-content";
import { useTranslation } from "@/i18n/client";
import {
	presentVariantRelations,
	type UnitVariantContext,
} from "../model/unit-variant-presentation";
import { publicUnitHref } from "../routing/public-unit-route";

export function UnitVariantList({
	context,
	showEmpty = true,
}: {
	readonly context: UnitVariantContext;
	readonly showEmpty?: boolean;
}) {
	const { t } = useTranslation(["actions", "state", "units"]);
	const related = presentVariantRelations(context);
	if (!showEmpty && !related.length) return null;

	return (
		<section className="grid gap-3">
			<div className="grid gap-1">
				<h2 className="font-heading text-xl font-bold">{t.units.detail.variants}</h2>
				<p className="text-sm text-muted-foreground">{t.units.detail.variantsDescription}</p>
			</div>
			{related.length ? (
				<FeedList
					aria-label={t.units.detail.variants}
					emptyBody={t.units.detail.noVariants}
					emptyTitle={t.units.detail.noVariants}
					errorLabel={t.state.error}
					getItemKey={({ unit }) => unit.id}
					renderItem={({ relation, unit }, metadata) => (
						<UnitVariantCard
							position={metadata.position}
							relation={relation}
							setSize={metadata.setSize}
							unit={unit}
						/>
					)}
					retryLabel={t.actions.retry}
					state={{ status: "ready", items: related }}
				/>
			) : (
				<p className="text-sm text-muted-foreground">{t.units.detail.noVariants}</p>
			)}
		</section>
	);
}

function UnitVariantCard({
	position,
	relation,
	setSize,
	unit,
}: {
	readonly position: number;
	readonly relation: "main" | "variant";
	readonly setSize: number;
	readonly unit: ReturnType<typeof presentVariantRelations>[number]["unit"];
}) {
	const { t } = useTranslation(["feed", "ui", "units"]);
	const title = useChineseContentText(unit.title ?? t.ui.unnamed, unit.language);
	const headingId = `unit-variant-${unit.id}`;

	return (
		<FeedCard aria-labelledby={headingId} aria-posinset={position} aria-setsize={setSize}>
			<FeedUnitContent
				action={<FeedOverflowMenu canExclude={false} itemId={unit.id} />}
				coverUrl={unit.cover?.url}
				headingId={headingId}
				headingLevel={3}
				href={publicUnitHref(unit.type, unit)}
				kind={unit.type}
				kindLabel={t.feed.content.kinds[`unit:${unit.type}`]}
				metadata={
					<p className="mt-2 text-muted-foreground text-xs">
						{relation === "main" ? t.units.detail.main : t.units.detail.version}
					</p>
				}
				standalone
				title={title}
			/>
		</FeedCard>
	);
}
