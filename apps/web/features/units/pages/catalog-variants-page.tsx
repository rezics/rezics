"use client";

import { Button, Card, CardContent, Cover } from "@rezics/ui";
import Link from "next/link";

import { useTranslation } from "@/i18n/client";
import { CatalogDetailSectionFrame } from "../components/catalog-detail-section-frame";
import { useCatalogDetail } from "../components/catalog-detail-workspace";

export function CatalogVariantsPage() {
	const detail = useCatalogDetail();
	const { t } = useTranslation(["engagement", "ui", "units"]);
	const labels =
		detail.type === "book"
			? {
					title: t.units.detail.tabs.book.editions,
					description: t.units.detail.sectionDescriptions.book.editions,
				}
			: detail.type === "media"
				? {
						title: t.units.detail.tabs.media.versions,
						description: t.units.detail.sectionDescriptions.media.versions,
					}
				: {
						title: t.units.detail.tabs.software.versions,
						description: t.units.detail.sectionDescriptions.software.versions,
					};
	const context = detail.unit.variantContext;
	const related =
		context.role === "main"
			? context.variants.map((unit) => ({
					relation: "variant" as const,
					unit,
				}))
			: context.role === "variant" && context.main.state === "available"
				? [{ relation: "primary" as const, unit: context.main.unit }]
				: [];
	return (
		<CatalogDetailSectionFrame description={labels.description} title={labels.title}>
			{related.length ? (
				<div className="grid gap-3 sm:grid-cols-2">
					{related.map(({ relation, unit }) => (
						<Card key={unit.id}>
							<CardContent
								className={
									unit.cover
										? "grid grid-cols-[4.5rem_minmax(0,1fr)] gap-4 p-4"
										: "p-4"
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
											{relation === "primary"
												? t.units.detail.primary
												: t.units.detail.version}
										</span>
									</div>
									<Button asChild size="sm" variant="outline">
										<Link href={`/units/${unit.type}/${unit.id}`}>
											{t.engagement.select}
										</Link>
									</Button>
								</div>
							</CardContent>
						</Card>
					))}
				</div>
			) : (
				<p className="text-sm text-muted-foreground">{t.units.detail.noVersions}</p>
			)}
		</CatalogDetailSectionFrame>
	);
}
