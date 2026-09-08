"use client";

import { useUnitSummary } from "@/features/units/hooks/use-unit-summary";
import type { UnitDetailUnitType } from "@/features/units/model/unit-detail-section";
import { Button, PageHeading, QueryFailure, QueryPending } from "@rezics/ui";
import { AppLink as Link } from "@/features/application-shell/components/app-link";
import { ArrowLeft } from "lucide-react";

import { UnitReviewFeed } from "@/features/reviews/components/unit-review-feed";
import { targetedReviewCreateHref } from "@/features/reviews/routing/review-routes";
import { useTranslation } from "@/i18n/client";
import { unitDetailHref } from "../routing/unit-detail-routes";

export function UnitReviewsPage({
	type,
	unitId,
}: {
	readonly type: UnitDetailUnitType;
	readonly unitId: string;
}) {
	const { t } = useTranslation(["engagement", "ui", "units"]);
	const query = useUnitSummary({ owner: type, id: unitId });
	if (query.isPending) return <QueryPending />;
	if (query.isError || !query.data)
		return <QueryFailure error={query.error} retry={() => void query.refetch()} />;
	const localization = query.data;
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
						<Link href={targetedReviewCreateHref(type, unitId)}>{t.engagement.newReview}</Link>
					</Button>
				}
				description={localization?.title ?? t.ui.unnamed}
				title={t.engagement.reviews}
			/>

			<UnitReviewFeed mode="page" targetId={unitId} />
		</main>
	);
}
