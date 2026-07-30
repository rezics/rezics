"use client";

import { useGetApiUnitsByTypeByUnitId } from "@rezics/openapi-tanstack-query";
import { Button, PageHeading, QueryFailure, QueryPending } from "@rezics/ui";
import { ArrowLeft } from "lucide-react";
import { AppLink as Link } from "@/features/application-shell/components/app-link";

import { useTranslation } from "@/i18n/client";
import { useLocalizationFallbackToast } from "@/i18n/use-localization-fallback-toast";
import { useLocalizationLanguages } from "@/i18n/use-localization-languages";
import { selectLocalization } from "@/lib/localization";
import { DetailedCreditAttributionGroups } from "../components/unit-attribution-sections";
import type { UnitDetailUnitType } from "../model/unit-detail-section";
import { isUnitDetailUnitFor } from "../model/unit-detail-unit";
import { unitDetailHref } from "../routing/unit-detail-routes";

export function UnitCreditsPage({ type, unitId }: { type: UnitDetailUnitType; unitId: string }) {
	const { t } = useTranslation(["state", "ui", "units"]);
	const localizationLanguages = useLocalizationLanguages();
	const query = useGetApiUnitsByTypeByUnitId({
		path: { type, unitId },
		query: { localizationLanguages },
	});
	useLocalizationFallbackToast({
		actualLanguage: query.data?.language ?? null,
		localizationLanguages,
		unitId,
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

	const localization = selectLocalization(
		query.data.localizations,
		query.data.language,
		query.data.language,
	);
	return (
		<main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-6 sm:px-6 sm:py-10">
			<Button asChild className="w-fit" variant="outline">
				<Link href={unitDetailHref(type, unitId)}>
					<ArrowLeft aria-hidden />
					{t.units.detail.backToOverview}
				</Link>
			</Button>
			<PageHeading
				description={localization?.title ?? t.ui.unnamed}
				title={t.units.detail.credits}
			/>
			{query.data.attributions.length ? (
				<DetailedCreditAttributionGroups attributions={query.data.attributions} />
			) : (
				<p className="text-sm text-muted-foreground">{t.state.empty}</p>
			)}
		</main>
	);
}
