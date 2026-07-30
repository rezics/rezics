"use client";

import { Button } from "@rezics/ui";
import { BookOpen } from "lucide-react";
import { AppLink as Link } from "@/features/application-shell/components/app-link";

import type { CatalogDetailUnitType } from "@/features/units/model/catalog-detail-section";
import { useTranslation } from "@/i18n/client";
import { UnitScoreControl } from "./unit-score-control";
import { UnitReviewFeed } from "./unit-review-feed";

export function UnitRatingsReviewsSection({
	moreReviewsHref,
	targetId,
	type,
	writeReviewHref,
}: {
	readonly moreReviewsHref: string;
	readonly targetId: string;
	readonly type: CatalogDetailUnitType;
	readonly writeReviewHref: string;
}) {
	const { t } = useTranslation(["engagement"]);

	return (
		<section className="grid gap-8 border-t border-border-weak pt-8">
			<h2 className="font-heading text-2xl font-bold sm:text-3xl">
				{t.engagement.ratingsAndReviews}
			</h2>

			<div className="grid justify-items-center gap-4 py-3 text-center sm:py-6">
				<span className="grid size-14 place-items-center rounded-full bg-surface-muted text-muted-foreground">
					<BookOpen aria-hidden className="size-7" />
				</span>
				<h3 className="font-heading text-2xl font-bold sm:text-3xl">
					{t.engagement.whatDoYouThink}
				</h3>
				<div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
					<UnitScoreControl targetId={targetId} type={type} />
					<Button asChild className="mt-1 rounded-full px-6" variant="solid">
						<Link href={writeReviewHref}>{t.engagement.newReview}</Link>
					</Button>
				</div>
			</div>

			<div className="grid gap-6 border-t border-border-weak pt-7">
				<h3 className="font-heading text-xl font-bold sm:text-2xl">
					{t.engagement.communityReviews}
				</h3>
				<UnitReviewFeed
					mode="preview"
					moreReviewsHref={moreReviewsHref}
					targetId={targetId}
				/>
			</div>
		</section>
	);
}
