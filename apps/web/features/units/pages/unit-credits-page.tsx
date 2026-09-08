"use client";

import { useListResourceCreditAttributions } from "@rezics/openapi-tanstack-query";
import { Button, PageHeading, QueryFailure, QueryPending } from "@rezics/ui";
import { ArrowLeft } from "lucide-react";
import { AppLink as Link } from "@/features/application-shell/components/app-link";

import { useTranslation } from "@/i18n/client";
import { useState } from "react";
import { useUnitSummary } from "../hooks/use-unit-summary";
import { useLocalizationLanguages } from "@/i18n/use-localization-languages";
import { DetailedCreditAttributionGroups } from "../components/unit-attribution-sections";
import type { UnitDetailUnitType } from "../model/unit-detail-section";
import { unitDetailHref } from "../routing/unit-detail-routes";

export function UnitCreditsPage({ type, unitId }: { type: UnitDetailUnitType; unitId: string }) {
	const { t } = useTranslation(["state", "ui", "units"]);
	const localizationLanguages = useLocalizationLanguages();
	const [cursors, setCursors] = useState<string[]>([]);
	const summary = useUnitSummary({ owner: type, id: unitId });
	const query = useListResourceCreditAttributions({
		path: { owner: type, unitId },
		query: { localizationLanguages, limit: 25, cursor: cursors.at(-1) },
	});
	if (query.isPending) return <QueryPending />;
	if (query.isError || !query.data)
		return <QueryFailure error={query.error} retry={() => void query.refetch()} />;

	const localization = summary.data;
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
			{query.data.items.length ? (
				<DetailedCreditAttributionGroups attributions={query.data.items} />
			) : !query.data.nextCursor && !cursors.length ? (
				<p className="text-sm text-muted-foreground">{t.state.empty}</p>
			) : null}
			<div className="flex gap-2">
				{cursors.length ? (
					<Button variant="outline" onClick={() => setCursors((value) => value.slice(0, -1))}>
						{t.ui.shelf.previous}
					</Button>
				) : null}
				{query.data.nextCursor ? (
					<Button
						variant="outline"
						onClick={() => {
							const next = query.data.nextCursor;
							if (next) setCursors((value) => [...value, next]);
						}}
					>
						{t.ui.shelf.next}
					</Button>
				) : null}
			</div>
		</main>
	);
}
