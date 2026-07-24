"use client";

import { toContentLanguage } from "@rezics/i18n";
import { Card, CardContent, EntityPicker, Field, FieldLabel } from "@rezics/ui";
import { useState } from "react";

import { SignInButton } from "@/features/auth/auth-portal";
import { ReviewComposer } from "@/features/reviews/components/review-composer";
import { ScoreOverview } from "@/features/reviews/components/score-overview";
import { UnitReviewList } from "@/features/reviews/components/unit-review-list";
import { useDefaultScoreRealm } from "@/features/reviews/data/default-score-realm";
import { useTranslation } from "@/i18n/client";
import { selectLocalization } from "@/lib/localization";
import { useHydratedSession } from "@/lib/use-hydrated-session";
import { CatalogDetailSectionFrame } from "../components/catalog-detail-section-frame";
import { useCatalogDetail } from "../components/catalog-detail-workspace";

interface PickedRealm {
	readonly id: string;
	readonly label: string;
}

export function CatalogReviewsPage() {
	const detail = useCatalogDetail();
	const { data: session } = useHydratedSession();
	const { locale, t } = useTranslation(["actions", "engagement", "units"]);
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
	const title = selectLocalization(
		detail.unit.localizations,
		toContentLanguage(locale.target),
		detail.unit.language,
	)?.title;
	return (
		<CatalogDetailSectionFrame description={labels.description} title={labels.title}>
			<Field>
				<FieldLabel>{t.engagement.filterReviewRealm}</FieldLabel>
				<EntityPicker index="realms" onChange={setRealm} value={realm} />
			</Field>
			{scoreRealm ? (
				<ScoreOverview realmId={scoreRealm.id} targetId={detail.unit.id} />
			) : null}
			<Card>
				<CardContent className="p-5 sm:p-6">
					{session ? (
						<ReviewComposer
							onCreated={() => undefined}
							target={{
								id: detail.unit.id,
								label: title ?? detail.unit.id,
							}}
						/>
					) : (
						<SignInButton variant="outline">{t.actions.login}</SignInButton>
					)}
				</CardContent>
			</Card>
			<UnitReviewList realmId={realm?.id} targetId={detail.unit.id} />
		</CatalogDetailSectionFrame>
	);
}
