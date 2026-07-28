"use client";

import type { ListCurrentUserStudioContentStatus200 } from "@rezics/openapi-tanstack-query";
import { Badge, CardContent, ContentCard, Cover, LinkBox, LinkOverlay } from "@rezics/ui";
import { ChevronRightIcon } from "lucide-react";
import Link from "next/link";

import { formatRelativeTime } from "@/features/content-feed/model/format-relative-time";
import { UnitCoverFallback } from "@/features/units/components/unit-cover-fallback";
import { useTranslation } from "@/i18n/client";
import { toNonNegativeApiInteger } from "@/lib/api-number";
import type { StudioSort } from "../model/studio-filters";
import { studioContentHref, type StudioSectionId } from "../model/studio-section";

export type StudioContentItem = ListCurrentUserStudioContentStatus200["items"][number];

const StudioCoverSections = new Set<StudioSectionId>(["book", "software", "media", "collection"]);

export function studioContentShowsCover(
	item: Pick<StudioContentItem, "cover" | "section">,
): boolean {
	return item.cover !== null || StudioCoverSections.has(item.section);
}

export function studioContentActivity(
	item: Pick<StudioContentItem, "createdAt" | "lastVisitedAt" | "relevantAt" | "updatedAt">,
	sort: StudioSort,
): {
	readonly kind: "created" | "relevant" | "updated" | "visited";
	readonly value: string;
} {
	switch (sort) {
		case "created":
			return { kind: "created", value: item.createdAt };
		case "updated":
			return { kind: "updated", value: item.updatedAt };
		case "relevant":
			return { kind: "relevant", value: item.relevantAt };
		case "recent":
			return item.lastVisitedAt
				? { kind: "visited", value: item.lastVisitedAt }
				: { kind: "relevant", value: item.relevantAt };
	}
}

function statusVariant(status: StudioContentItem["status"]): "secondary" | "success" | "warning" {
	switch (status) {
		case "archived":
			return "secondary";
		case "draft":
			return "warning";
		case "published":
			return "success";
	}
}

export function StudioContentCard({
	item,
	onOpen,
	sort,
}: {
	readonly item: StudioContentItem;
	readonly onOpen: () => void;
	readonly sort: StudioSort;
}) {
	const { locale, t } = useTranslation(["create"]);
	const title = item.title ?? t.create.list.untitled;
	const href = studioContentHref(item.section, item.id);
	const activity = studioContentActivity(item, sort);
	const contributionCount = toNonNegativeApiInteger(item.contributionCount);
	const titleId = `studio-content-${item.id}`;
	const showCover = studioContentShowsCover(item);

	return (
		<ContentCard
			appearance="outlined"
			aria-labelledby={titleId}
			className="overflow-hidden rounded-2xl focus-within:ring-[3px] focus-within:ring-ring/32"
			data-slot="studio-content-card"
		>
			<LinkBox
				className={
					showCover
						? "grid grid-cols-[5rem_minmax(0,1fr)] gap-4 p-4 sm:grid-cols-[6rem_minmax(0,1fr)_auto] sm:gap-5 sm:p-5"
						: "grid grid-cols-[minmax(0,1fr)_auto] gap-4 p-4 sm:p-5"
				}
			>
				{showCover ? (
					<Cover
						alt={title}
						className="w-full rounded-xl border border-border-weak shadow-sm/5"
						fallback={<UnitCoverFallback kind={item.section} />}
						sizes="(min-width: 640px) 96px, 80px"
						src={item.cover?.url}
					/>
				) : null}
				<CardContent className="min-w-0 p-0">
					<p className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 text-muted-foreground text-xs">
						<span>{t.create.list.activity[activity.kind]}</span>
						<span aria-hidden>·</span>
						<time dateTime={activity.value}>
							{formatRelativeTime(activity.value, locale.target)}
						</time>
					</p>
					<h3
						className="mt-2 font-heading font-black text-[1.05rem] leading-snug sm:text-lg"
						id={titleId}
					>
						<LinkOverlay asChild>
							<Link href={href} onClick={onOpen}>
								{title}
							</Link>
						</LinkOverlay>
					</h3>
					<div className="mt-3 flex flex-wrap gap-1.5">
						<Badge size="sm" variant={statusVariant(item.status)}>
							{t.create.filters.statuses[item.status]}
						</Badge>
						<Badge size="sm" variant="outline">
							{t.create.filters.visibilities[item.visibility]}
						</Badge>
						{item.workState === "blocked" ? (
							<Badge size="sm" variant="warning">
								{t.create.relations.blocked}
							</Badge>
						) : null}
					</div>
					<div className="mt-3 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground text-xs">
						{item.relations.map((relation) => (
							<span key={relation}>{t.create.relations[relation]}</span>
						))}
						{contributionCount > 0 ? (
							<span>
								{t.create.list.contributionCount({
									count: contributionCount,
								})}
							</span>
						) : null}
					</div>
				</CardContent>
				<ChevronRightIcon
					aria-hidden
					className="self-center text-muted-foreground max-sm:hidden rtl:rotate-180"
				/>
			</LinkBox>
		</ContentCard>
	);
}
