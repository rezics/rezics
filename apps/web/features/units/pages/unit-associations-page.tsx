"use client";

import type { ContentLanguage } from "@rezics/i18n";
import { Button, Card, CardContent, Cover } from "@rezics/ui";
import { AppLink as Link } from "@/features/application-shell/components/app-link";

import { LocalizedText } from "@/features/content-language-display/chinese-content-display-context";
import { FeedOverflowMenu } from "@/features/content-feed/components/feed-card-actions";
import { FeedList } from "@/features/content-feed/components/feed-list";
import { useTranslation } from "@/i18n/client";
import { UnitDetailSectionFrame } from "../components/unit-detail-section-frame";
import { UnitSeriesMemberships } from "../components/unit-series-memberships";
import { UnitSubjectGroups } from "../components/unit-subject-groups";
import { useUnitDetail } from "../components/unit-detail-workspace";
import { unitDetailPageCopy } from "../model/unit-detail-copy";

export function UnitAssociationsPage() {
	const detail = useUnitDetail();
	const { t } = useTranslation(["actions", "engagement", "feed", "state", "ui", "units"]);
	const labels = unitDetailPageCopy(t, detail.type, "associations");
	const context = detail.unit.variantContext;
	const related: {
		readonly relation: "main" | "variant";
		readonly unit: {
			readonly id: string;
			readonly type: string;
			readonly language: ContentLanguage;
			readonly title: string | null;
			readonly cover: { readonly url: string } | null;
		};
	}[] =
		context.role === "main"
			? context.variants.map((unit) => ({
					relation: "variant" as const,
					unit,
				}))
			: context.role === "variant" && context.main.state === "available"
				? [{ relation: "main" as const, unit: context.main.unit }]
				: [];

	return (
		<UnitDetailSectionFrame description={labels.description} title={labels.title}>
			<section className="grid gap-3">
				<div className="grid gap-1">
					<h2 className="font-heading text-xl font-bold">{t.units.detail.subjectAssociations}</h2>
				</div>
				{detail.unit.subjectAssociations.length ? (
					<UnitSubjectGroups associations={detail.unit.subjectAssociations} />
				) : (
					<p className="text-sm text-muted-foreground">{t.state.empty}</p>
				)}
			</section>

			{detail.type === "series" ? null : (
				<>
					<UnitSeriesMemberships unitId={detail.unit.id} />
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
														<Link href={`/units/${unit.type}/${unit.id}`}>
															{t.engagement.select}
														</Link>
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
				</>
			)}
		</UnitDetailSectionFrame>
	);
}
