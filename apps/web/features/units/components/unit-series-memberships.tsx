"use client";

import {
	type GetApiUnitsByIdByUnitIdSeriesMembershipsStatus200,
	useGetApiUnitsByIdByUnitIdSeriesMemberships,
} from "@rezics/openapi-tanstack-query";

import { FeedCard } from "@/features/content-feed/components/feed-card";
import { FeedList } from "@/features/content-feed/components/feed-list";
import { FeedUnitContent } from "@/features/content-feed/components/feed-unit-content";
import { useChineseContentText } from "@/features/content-language-display/chinese-content-display-context";
import { useTranslation } from "@/i18n/client";
import { useLocalizationLanguages } from "@/i18n/use-localization-languages";
import { unitDetailHref } from "../routing/unit-detail-routes";

type SeriesMembership = GetApiUnitsByIdByUnitIdSeriesMembershipsStatus200["items"][number];

export function UnitSeriesMemberships({ unitId }: { readonly unitId: string }) {
	const { t } = useTranslation(["actions", "state", "units"]);
	const localizationLanguages = useLocalizationLanguages();
	const query = useGetApiUnitsByIdByUnitIdSeriesMemberships({
		path: { unitId },
		query: { localizationLanguages },
	});
	const items = query.data?.items ?? [];
	const state = query.isPending
		? ({ status: "pending" } as const)
		: query.isError
			? ({ status: "error", retry: () => void query.refetch() } as const)
			: ({ status: "ready", items } as const);

	return (
		<section className="grid gap-3">
			<h2 className="font-heading text-xl font-bold">{t.units.types.series}</h2>
			<FeedList
				aria-label={t.units.types.series}
				emptyBody={t.units.detail.noSeriesMemberships}
				emptyTitle={t.units.detail.noSeriesMemberships}
				errorLabel={t.state.error}
				getItemKey={(item) => item.series.id}
				renderItem={(item, metadata) => (
					<SeriesMembershipCard
						item={item}
						position={metadata.position}
						setSize={metadata.setSize}
					/>
				)}
				retryLabel={t.actions.retry}
				state={state}
			/>
		</section>
	);
}

function SeriesMembershipCard({
	item,
	position,
	setSize,
}: {
	readonly item: SeriesMembership;
	readonly position: number;
	readonly setSize: number;
}) {
	const { t } = useTranslation(["feed", "ui"]);
	const title = useChineseContentText(item.series.title ?? t.ui.unnamed, item.series.language);
	const headingId = `series-membership-${item.series.id}`;

	return (
		<FeedCard aria-labelledby={headingId} aria-posinset={position} aria-setsize={setSize}>
			<FeedUnitContent
				coverUrl={item.series.cover?.url}
				headingId={headingId}
				headingLevel={3}
				href={unitDetailHref("series", item.series.id)}
				kind="series"
				kindLabel={t.feed.content.kinds["unit:series"]}
				standalone
				title={title}
			/>
		</FeedCard>
	);
}
