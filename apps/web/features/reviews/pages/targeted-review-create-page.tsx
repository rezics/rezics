"use client";

import { useUnitSummary } from "@/features/units/hooks/use-unit-summary";
import type { UnitDetailUnitType } from "@/features/units/model/unit-detail-section";
import { PageHeading, QueryFailure, QueryPending } from "@rezics/ui";
import { useApplicationRouter } from "@/features/application-shell/hooks/use-application-router";

import { RequireSession } from "@/features/auth/require-session";
import { postHref } from "@/features/posts/url";
import { useTranslation } from "@/i18n/client";
import { useLocalizationFallbackToast } from "@/i18n/use-localization-fallback-toast";
import { useLocalizationLanguages } from "@/i18n/use-localization-languages";
import { ReviewComposer } from "../components/review-composer";

export function TargetedReviewCreatePage({
	progressEntryId,
	targetId,
	type,
}: {
	readonly progressEntryId?: string;
	readonly targetId: string;
	readonly type: UnitDetailUnitType;
}) {
	const localizationLanguages = useLocalizationLanguages();
	const query = useUnitSummary({ owner: type, id: targetId });
	const router = useApplicationRouter();
	const { t } = useTranslation(["engagement", "ui"]);
	useLocalizationFallbackToast({
		actualLanguage: query.data?.language ?? null,
		localizationLanguages,
		unitId: targetId,
	});

	if (query.isPending) return <QueryPending />;
	if (query.isError || !query.data)
		return <QueryFailure error={query.error} retry={() => void query.refetch()} />;

	const title = query.data.title;

	return (
		<RequireSession>
			<main className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-10 sm:px-6">
				<PageHeading description={title ?? t.ui.unnamed} title={t.engagement.newReview} />
				<ReviewComposer
					onCreated={(reviewId) => router.push(postHref(reviewId))}
					progressEntryId={progressEntryId}
					target={{
						id: query.data.id,
						label: title ?? t.ui.unnamed,
					}}
				/>
			</main>
		</RequireSession>
	);
}
