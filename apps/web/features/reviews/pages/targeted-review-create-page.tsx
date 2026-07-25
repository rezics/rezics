"use client";

import { toContentLanguage } from "@rezics/i18n";
import { useGetApiUnitsByTypeByUnitId } from "@rezics/openapi-tanstack-query";
import { PageHeading, QueryFailure, QueryPending } from "@rezics/ui";
import { useRouter } from "next/navigation";

import { RequireSession } from "@/features/auth/require-session";
import { isCatalogDetailUnitFor } from "@/features/units/model/catalog-detail-unit";
import type { CatalogDetailUnitType } from "@/features/units/model/catalog-detail-section";
import { useTranslation } from "@/i18n/client";
import { selectLocalization } from "@/lib/localization";
import { ReviewComposer } from "../components/review-composer";

export function TargetedReviewCreatePage({
	targetId,
	type,
}: {
	readonly targetId: string;
	readonly type: CatalogDetailUnitType;
}) {
	const query = useGetApiUnitsByTypeByUnitId({ path: { type, unitId: targetId } });
	const router = useRouter();
	const { locale, t } = useTranslation(["engagement", "ui"]);

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

	const title = selectLocalization(
		query.data.localizations,
		toContentLanguage(locale.target),
		query.data.language,
	)?.title;

	return (
		<RequireSession>
			<main className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-10 sm:px-6">
				<PageHeading description={title ?? t.ui.unnamed} title={t.engagement.newReview} />
				<ReviewComposer
					onCreated={(reviewId) => router.push(`/reviews/${reviewId}`)}
					target={{
						id: query.data.id,
						label: title ?? t.ui.unnamed,
					}}
				/>
			</main>
		</RequireSession>
	);
}
