"use client";

import { Badge, Button, Card, CardContent, Cover } from "@rezics/ui";
import Link from "next/link";

import { useTranslation } from "@/i18n/client";
import { CatalogDetailSectionFrame } from "../components/catalog-detail-section-frame";
import { useCatalogDetail } from "../components/catalog-detail-workspace";

export function CatalogAssociationsPage() {
	const detail = useCatalogDetail();
	const { t } = useTranslation(["engagement", "state", "ui", "units"]);
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
	const related =
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
					<div className="grid gap-3 sm:grid-cols-2">
						{detail.unit.subjectAssociations.map((association) => (
							<Card key={association.id}>
								<CardContent className="flex items-start justify-between gap-4 p-4">
									<Link
										className="min-w-0 font-semibold text-link hover:text-link-hover hover:underline"
										href={`/entities/${association.entityEntryId}`}
									>
										{association.title ?? t.ui.unnamed}
									</Link>
									<Badge className="shrink-0" variant="outline">
										{association.role}
									</Badge>
								</CardContent>
							</Card>
						))}
					</div>
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
								</CardContent>
							</Card>
						))}
					</div>
				) : (
					<p className="text-sm text-muted-foreground">{t.units.detail.noVariants}</p>
				)}
			</section>
		</CatalogDetailSectionFrame>
	);
}
