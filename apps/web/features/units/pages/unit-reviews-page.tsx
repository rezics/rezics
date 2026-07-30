"use client";

import { useGetApiUnitsByTypeByUnitId } from "@rezics/openapi-tanstack-query";
import { Button, PageHeading, QueryFailure, QueryPending } from "@rezics/ui";
import { AppLink as Link } from "@/features/application-shell/components/app-link";
import { ArrowLeft } from "lucide-react";

import { UnitReviewFeed } from "@/features/reviews/components/unit-review-feed";
import { targetedReviewCreateHref } from "@/features/reviews/routing/review-routes";
import { useTranslation } from "@/i18n/client";
import { useLocalizationLanguages } from "@/i18n/use-localization-languages";
import type { UnitDetailUnitType } from "../model/unit-detail-section";
import { unitDetailPageCopy } from "../model/unit-detail-copy";
import { isUnitDetailUnitFor } from "../model/unit-detail-unit";
import { unitDetailHref } from "../routing/unit-detail-routes";

export function UnitReviewsPage({
	type,
	unitId,
}: {
	readonly type: UnitDetailUnitType;
	readonly unitId: string;
}) {
	const { t } = useTranslation(["engagement", "ui", "units"]);
	const localizationLanguages = useLocalizationLanguages();
	const query = useGetApiUnitsByTypeByUnitId({
		path: { type, unitId },
		query: { localizationLanguages },
	});
	if (query.isPending) return <QueryPending />;
	if (query.isError || !query.data)
		return <QueryFailure error={query.error} retry={() => void query.refetch()} />;
	if (!isUnitDetailUnitFor(query.data, type))
		return (
			<QueryFailure
				error={new Error("Unit Unit type mismatch")}
				retry={() => void query.refetch()}
			/>
		);
	const labels = unitDetailPageCopy(t, type, "reviews");
	const localization =
		query.data.localizations.find(({ language }) => language === query.data.language) ??
		query.data.localizations[0];
	return (
		<main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-6 sm:px-6 sm:py-10">
			<Button asChild className="w-fit" variant="outline">
				<Link href={unitDetailHref(type, unitId)}>
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
			<UnitReviewFeed mode="page" targetId={unitId} />
		</main>
	);
}
