"use client";

import { Button, Card, CardContent, Cover } from "@rezics/ui";

import { AppLink as Link } from "@/features/application-shell/components/app-link";
import { LocalizedText } from "@/features/content-language-display/chinese-content-display-context";
import { FeedOverflowMenu } from "@/features/content-feed/components/feed-card-actions";
import { FeedList } from "@/features/content-feed/components/feed-list";
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
	const { t } = useTranslation(["actions", "engagement", "state", "ui", "units"]);
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
						<Card asChild className="gap-0 rounded-none py-0 sm:rounded-2xl">
							<article aria-posinset={metadata.position} aria-setsize={metadata.setSize}>
								<CardContent
									className={
										unit.cover
											? "grid grid-cols-[4.5rem_minmax(0,1fr)_auto] gap-4 p-4"
											: "grid grid-cols-[minmax(0,1fr)_auto] gap-4 p-4"
									}
								>
									{unit.cover ? (
										<Cover
											alt={unit.title ?? t.ui.unnamed}
											className="rounded-lg border border-border-weak"
											src={unit.cover.url}
										/>
									) : null}
									<div className="flex min-w-0 items-center justify-between gap-3">
										<div className="grid min-w-0 gap-1">
											<strong>
												{unit.title ? (
													<LocalizedText language={unit.language} value={unit.title} />
												) : (
													t.ui.unnamed
												)}
											</strong>
											<span className="text-xs text-muted-foreground">
												{relation === "main" ? t.units.detail.main : t.units.detail.version}
											</span>
										</div>
										<Button asChild size="sm" variant="outline">
											<Link href={publicUnitHref(unit.type, unit)}>{t.engagement.select}</Link>
										</Button>
									</div>
									<FeedOverflowMenu canExclude={false} itemId={unit.id} />
								</CardContent>
							</article>
						</Card>
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
