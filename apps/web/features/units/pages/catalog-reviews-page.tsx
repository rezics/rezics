"use client";

import { Button, EntityPicker, Field, FieldLabel } from "@rezics/ui";
import Link from "next/link";
import { useState } from "react";

import { ScoreOverview } from "@/features/reviews/components/score-overview";
import { UnitReviewList } from "@/features/reviews/components/unit-review-list";
import { useDefaultScoreRealm } from "@/features/reviews/data/default-score-realm";
import { targetedReviewCreateHref } from "@/features/reviews/routing/review-routes";
import { useTranslation } from "@/i18n/client";
import { CatalogDetailSectionFrame } from "../components/catalog-detail-section-frame";
import { useCatalogDetail } from "../components/catalog-detail-workspace";

interface PickedRealm {
	readonly id: string;
	readonly label: string;
}

export function CatalogReviewsPage() {
	const detail = useCatalogDetail();
	const { t } = useTranslation(["engagement", "units"]);
	const [realm, setRealm] = useState<PickedRealm>();
	const defaultScoreRealm = useDefaultScoreRealm();
	const scoreRealm = realm ?? defaultScoreRealm.realm;
	const labels =
		detail.type === "book"
			? {
					title: t.units.detail.tabs.book.reviews,
					description: t.units.detail.sectionDescriptions.book.reviews,
				}
			: detail.type === "media"
				? {
						title: t.units.detail.tabs.media.reviews,
						description: t.units.detail.sectionDescriptions.media.reviews,
					}
				: {
						title: t.units.detail.tabs.software.reviews,
						description: t.units.detail.sectionDescriptions.software.reviews,
					};
	return (
		<CatalogDetailSectionFrame
			action={
				<Button asChild variant="solid">
					<Link href={targetedReviewCreateHref(detail.type, detail.unit.id)}>
						{t.engagement.newReview}
					</Link>
				</Button>
			}
			description={labels.description}
			title={labels.title}
		>
			<Field>
				<FieldLabel>{t.engagement.filterReviewRealm}</FieldLabel>
				<EntityPicker index="realms" onChange={setRealm} value={realm} />
			</Field>
			{scoreRealm ? (
				<ScoreOverview realmId={scoreRealm.id} targetId={detail.unit.id} />
			) : null}
			<UnitReviewList realmId={realm?.id} targetId={detail.unit.id} />
		</CatalogDetailSectionFrame>
	);
}
