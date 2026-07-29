"use client";

import { useGetApiUnitsByTypeByUnitId } from "@rezics/openapi-tanstack-query";
import {
	Button,
	EntityPicker,
	Field,
	FieldLabel,
	PageHeading,
	QueryFailure,
	QueryPending,
} from "@rezics/ui";
import { AppLink as Link } from "@/features/application-shell/components/app-link";
import { ArrowLeft } from "lucide-react";
import { useState } from "react";

import { ScoreOverview } from "@/features/reviews/components/score-overview";
import { UnitReviewList } from "@/features/reviews/components/unit-review-list";
import { useDefaultScoreContext } from "@/features/reviews/data/default-score-context";
import { targetedReviewCreateHref } from "@/features/reviews/routing/review-routes";
import { useTranslation } from "@/i18n/client";
import { useLocalizationLanguages } from "@/i18n/use-localization-languages";
import type { CatalogDetailUnitType } from "../model/catalog-detail-section";
import { isCatalogDetailUnitFor } from "../model/catalog-detail-unit";
import { catalogDetailHref } from "../routing/catalog-detail-routes";

interface PickedRealm {
	readonly id: string;
	readonly label: string;
}

export function CatalogReviewsPage({
	type,
	unitId,
}: {
	readonly type: CatalogDetailUnitType;
	readonly unitId: string;
}) {
	const { t } = useTranslation(["engagement", "ui", "units"]);
	const [realm, setRealm] = useState<PickedRealm>();
	const localizationLanguages = useLocalizationLanguages();
	const query = useGetApiUnitsByTypeByUnitId({
		path: { type, unitId },
		query: { localizationLanguages },
	});
	const defaultScoreContext = useDefaultScoreContext();
	const scoreContext = realm ?? defaultScoreContext.context;
	if (query.isPending) return <QueryPending />;
	if (query.isError || !query.data)
		return <QueryFailure error={query.error} retry={() => void query.refetch()} />;
	if (!isCatalogDetailUnitFor(query.data, type))
		return (
			<QueryFailure
				error={new Error("Catalog Unit type mismatch")}
				retry={() => void query.refetch()}
			/>
		);
	const labels =
		type === "book"
			? {
					title: t.units.detail.tabs.book.reviews,
					description: t.units.detail.sectionDescriptions.book.reviews,
				}
			: type === "media"
				? {
						title: t.units.detail.tabs.media.reviews,
						description: t.units.detail.sectionDescriptions.media.reviews,
					}
				: {
						title: t.units.detail.tabs.software.reviews,
						description: t.units.detail.sectionDescriptions.software.reviews,
					};
	const localization =
		query.data.localizations.find(({ language }) => language === query.data.language) ??
		query.data.localizations[0];
	return (
		<main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-6 sm:px-6 sm:py-10">
			<Button asChild className="w-fit" variant="outline">
				<Link href={catalogDetailHref(type, unitId)}>
					<ArrowLeft aria-hidden />
					{t.units.detail.backToOverview}
				</Link>
			</Button>
			<PageHeading
				action={
					<Button asChild variant="solid">
						<Link href={targetedReviewCreateHref(type, unitId)}>
							{t.engagement.newReview}
						</Link>
					</Button>
				}
				description={localization?.title ?? t.ui.unnamed}
				title={labels.title}
			/>
			<p className="-mt-5 max-w-3xl text-sm leading-6 text-muted-foreground">
				{labels.description}
			</p>
			<Field>
				<FieldLabel>{t.engagement.filterReviewRealm}</FieldLabel>
				<EntityPicker index="realms" onChange={setRealm} value={realm} />
			</Field>
			{scoreContext ? (
				<ScoreOverview contextUnitId={scoreContext.id} targetId={unitId} />
			) : null}
			<UnitReviewList realmIds={realm ? [realm.id] : undefined} targetId={unitId} />
		</main>
	);
}
