"use client";

import { useGetApiSeriesBySeriesIdReleases } from "@rezics/openapi-tanstack-query";
import { Button } from "@rezics/ui";

import { AppLink as Link } from "@/features/application-shell/components/app-link";
import { FeedList } from "@/features/content-feed/components/feed-list";
import { useTranslation } from "@/i18n/client";
import { useLocalizationLanguages } from "@/i18n/use-localization-languages";
import { SeriesReleaseCard } from "./series-release-card";

export function SeriesReleaseFeed({
	limit,
	seriesId,
}: {
	readonly limit?: number;
	readonly seriesId: string;
}) {
	const { t } = useTranslation(["actions", "state", "units"]);
	const localizationLanguages = useLocalizationLanguages();
	const query = useGetApiSeriesBySeriesIdReleases({
		path: { seriesId },
		query: { localizationLanguages },
	});
	const allItems = query.data?.items ?? [];
	const items = limit === undefined ? allItems : allItems.slice(0, limit);
	const state = query.isPending
		? ({ status: "pending" } as const)
		: query.isError
			? ({ status: "error", retry: () => void query.refetch() } as const)
			: ({ status: "ready", items } as const);
	const footer =
		limit !== undefined && allItems.length > items.length ? (
			<div className="mt-4 flex justify-end">
				<Button asChild variant="outline">
					<Link href={`/units/series/${seriesId}/releases`}>{t.units.series.viewAllReleases}</Link>
				</Button>
			</div>
		) : undefined;

	return (
		<FeedList
			aria-label={t.units.series.releases}
			emptyBody={t.units.series.noReleases}
			emptyTitle={t.units.series.noReleases}
			errorLabel={t.state.error}
			footer={footer}
			getItemKey={(item) => item.releaseUnitId}
			renderItem={(item, metadata) => (
				<SeriesReleaseCard item={item} position={metadata.position} setSize={allItems.length} />
			)}
			retryLabel={t.actions.retry}
			setSize={allItems.length}
			state={state}
		/>
	);
}
