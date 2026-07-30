"use client";

import type { GetApiSeriesBySeriesIdReleasesStatus200 } from "@rezics/openapi-tanstack-query";
import { CardContent, Cover, cn } from "@rezics/ui";
import { CalendarDays } from "lucide-react";
import type { ReactNode } from "react";

import { AppLink as Link } from "@/features/application-shell/components/app-link";
import { LocalizedText } from "@/features/content-language-display/chinese-content-display-context";
import { FeedCard } from "@/features/content-feed/components/feed-card";
import { useTranslation } from "@/i18n/client";
import { UnitCoverFallback } from "./unit-cover-fallback";

export type SeriesReleaseItem = GetApiSeriesBySeriesIdReleasesStatus200["items"][number];

export function SeriesReleaseCard({
	actions,
	item,
	position,
	setSize,
}: {
	readonly actions?: ReactNode;
	readonly item: SeriesReleaseItem;
	readonly position?: number;
	readonly setSize?: number;
}) {
	const { locale, t } = useTranslation(["feed", "ui", "units"]);
	const title = item.release.title ?? t.ui.unnamed;
	const href = `/units/${item.release.type}/${item.release.id}`;
	const headingId = `series-release-${item.seriesId}-${item.releaseUnitId}`;
	const releasedOn = formatReleaseDate(item.releasedOn, locale.current);

	return (
		<FeedCard aria-labelledby={headingId} aria-posinset={position} aria-setsize={setSize}>
			<CardContent
				className={cn(
					"grid grid-cols-[5rem_minmax(0,1fr)] gap-4 px-4 py-5 sm:grid-cols-[7.5rem_minmax(0,1fr)] sm:px-5",
					actions && "sm:grid-cols-[7.5rem_minmax(0,1fr)_auto]",
				)}
			>
				<Link className="block self-start" href={href}>
					<Cover
						alt={title}
						className="w-full rounded-xl border border-border-weak shadow-sm/5"
						fallback={<UnitCoverFallback kind={item.release.type} />}
						sizes="(min-width: 640px) 120px, 80px"
						src={item.release.cover?.url}
					/>
				</Link>
				<div className="min-w-0 self-start">
					<p className="font-semibold text-brand text-xs">
						{t.feed.content.kinds[`unit:${item.release.type}`]}
					</p>
					<Link className="block" href={href}>
						<h3
							className="mt-1 font-heading font-black text-[1.05rem] leading-snug"
							id={headingId}
						>
							<LocalizedText language={item.release.language} value={title} />
						</h3>
					</Link>
					{releasedOn ? (
						<p className="mt-3 flex items-center gap-1.5 text-muted-foreground text-sm">
							<CalendarDays aria-hidden className="size-4" />
							<span>{releasedOn}</span>
						</p>
					) : null}
				</div>
				{actions ? (
					<div className="col-span-2 flex flex-wrap items-center justify-end gap-1 self-center sm:col-span-1">
						{actions}
					</div>
				) : null}
			</CardContent>
		</FeedCard>
	);
}

function formatReleaseDate(value: string | null, language: string): string | undefined {
	if (!value) return undefined;
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(language).format(date);
}
