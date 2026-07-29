"use client";

import { Button, Card, CardContent, Cover } from "@rezics/ui";
import { AppLink as Link } from "@/features/application-shell/components/app-link";

import { FeedOverflowMenu } from "@/features/content-feed/components/feed-card-actions";
import { FeedList } from "@/features/content-feed/components/feed-list";
import { useTranslation } from "@/i18n/client";
import { CatalogDetailSectionFrame } from "../components/catalog-detail-section-frame";
import { CatalogSubjectGroups } from "../components/catalog-subject-groups";
import { useCatalogDetail } from "../components/catalog-detail-workspace";

export function CatalogAssociationsPage() {
	const detail = useCatalogDetail();
	const { t } = useTranslation(["actions", "engagement", "feed", "state", "ui", "units"]);
	const labels =
		detail.type === "book"
			? {
					title: t.units.detail.tabs.book.associations,
					description: t.units.detail.sectionDescriptions.book.associations,
				}
			: detail.type === "media"
				? {
						title: t.units.detail.tabs.media.associations,
						description: t.units.detail.sectionDescriptions.media.associations,
					}
				: {
						title: t.units.detail.tabs.software.associations,
						description: t.units.detail.sectionDescriptions.software.associations,
					};
	const context = detail.unit.variantContext;
	const related: {
		readonly relation: "main" | "variant";
		readonly unit: {
			readonly id: string;
			readonly type: string;
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
		<CatalogDetailSectionFrame description={labels.description} title={labels.title}>
			<section className="grid gap-3">
				<div className="grid gap-1">
					<h2 className="font-heading text-xl font-bold">
						{t.units.detail.subjectAssociations}
					</h2>
				</div>
				{detail.unit.subjectAssociations.length ? (
					<Card>
						<CardContent className="p-5 sm:p-6">
							<CatalogSubjectGroups associations={detail.unit.subjectAssociations} />
						</CardContent>
					</Card>
				) : (
					<p className="text-sm text-muted-foreground">{t.state.empty}</p>
				)}
			</section>

			<section className="grid gap-3">
				<div className="grid gap-1">
					<h2 className="font-heading text-xl font-bold">{t.units.detail.variants}</h2>
					<p className="text-sm text-muted-foreground">
						{t.units.detail.variantsDescription}
					</p>
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
								<article
									aria-posinset={metadata.position}
									aria-setsize={metadata.setSize}
								>
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
												<strong>{unit.title ?? t.ui.unnamed}</strong>
												<span className="text-xs text-muted-foreground">
													{relation === "main"
														? t.units.detail.main
														: t.units.detail.version}
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
		</CatalogDetailSectionFrame>
	);
}
