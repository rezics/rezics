"use client";

import { useGetApiEntitiesByUnitId } from "@rezics/openapi-tanstack-query";
import {
	Alert,
	AlertDescription,
	Button,
	PageHeading,
	QueryFailure,
	QueryPending,
} from "@rezics/ui";
import { ArrowLeft, CircleCheck } from "lucide-react";

import { AppLink as Link } from "@/features/application-shell/components/app-link";
import { useChineseContentText } from "@/features/content-language-display/chinese-content-display-context";
import { UnitTagExplorer } from "@/features/tags/components/unit-tag-explorer";
import type { UnitTagsRouteState } from "@/features/tags/routing/tag-links";
import { useTranslation } from "@/i18n/client";
import { useLocalizationFallbackToast } from "@/i18n/use-localization-fallback-toast";
import { useLocalizationLanguages } from "@/i18n/use-localization-languages";
import { selectLocalization } from "@/lib/localization";

export function EntityTagsPage({
	entityId,
	routeState,
}: {
	readonly entityId: string;
	readonly routeState: UnitTagsRouteState;
}) {
	const { t } = useTranslation(["tags", "ui", "units"]);
	const localizationLanguages = useLocalizationLanguages();
	const query = useGetApiEntitiesByUnitId({
		path: { unitId: entityId },
		query: { localizationLanguages },
	});
	useLocalizationFallbackToast({
		actualLanguage: query.data?.language ?? null,
		localizationLanguages,
		unitId: entityId,
	});
	const localization = query.data
		? selectLocalization(query.data.localizations, query.data.language ?? "")
		: null;
	const displayedTitle = useChineseContentText(
		localization?.title ?? t.ui.unnamed,
		localization?.language,
	);

	if (query.isPending) return <QueryPending />;
	if (query.isError || !query.data)
		return <QueryFailure error={query.error} retry={() => void query.refetch()} />;

	return (
		<main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-6 sm:px-6 sm:py-10">
			<Button asChild className="w-fit" variant="outline">
				<Link href={`/entities/${entityId}`}>
					<ArrowLeft aria-hidden />
					{t.units.detail.backToOverview}
				</Link>
			</Button>
			<PageHeading description={displayedTitle} title={t.tags.page.title} />
			<p className="-mt-5 max-w-3xl text-sm leading-6 text-muted-foreground">
				{t.tags.page.description}
			</p>
			{routeState.createdTagId ? (
				<Alert role="status" variant="success">
					<CircleCheck aria-hidden />
					<AlertDescription>{t.tags.create.completed}</AlertDescription>
				</Alert>
			) : null}
			<UnitTagExplorer
				highlightedTagId={routeState.createdTagId}
				initialVoteContext={routeState.context}
				surface="page"
				type="entity"
				unitId={entityId}
			/>
		</main>
	);
}
