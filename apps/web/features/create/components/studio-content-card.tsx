"use client";

import type {
	ListCurrentUserContributionResourcesStatus200,
	ListCurrentUserStudioContentStatus200,
} from "@rezics/openapi-tanstack-query";
import { Badge, CardContent, ContentCard, Cover, LinkBox, LinkOverlay } from "@rezics/ui";
import { ChevronRightIcon } from "lucide-react";

import { AppLink as Link } from "@/features/application-shell/components/app-link";
import { formatRelativeTime } from "@/features/content-feed/model/format-relative-time";
import { TagPathPath } from "@/features/tags/components/tag-path";
import { tagPathHref } from "@/features/tags/routing/tag-links";
import { UnitCoverFallback } from "@/features/units/components/unit-cover-fallback";
import { useTranslation } from "@/i18n/client";
import { toNonNegativeApiInteger } from "@/lib/api-number";
import { studioContentHref, type StudioSectionId } from "../model/studio-section";

type WorkspaceResource = ListCurrentUserStudioContentStatus200["items"][number];
type ContributionResource = ListCurrentUserContributionResourcesStatus200["items"][number];

export type StudioContentItem =
	| { readonly kind: "workspace"; readonly resource: WorkspaceResource }
	| { readonly kind: "contribution"; readonly resource: ContributionResource };

const StudioCoverSections = new Set<StudioSectionId>(["book", "software", "media", "collection"]);

export function studioContentShowsCover(item: {
	readonly cover: { readonly url: string } | null;
	readonly section: StudioSectionId;
}): boolean {
	return item.cover !== null || StudioCoverSections.has(item.section);
}

function statusVariant(status: WorkspaceResource["status"]): "secondary" | "success" | "warning" {
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
}: {
	readonly item: StudioContentItem;
	readonly onOpen: () => void;
}) {
	const { locale, t } = useTranslation(["create", "tags"]);
	const presentation =
		item.kind === "workspace"
			? {
					kind: "localized_unit" as const,
					slugAddress: item.resource.slugAddress,
					language: item.resource.language,
					title: item.resource.title,
					cover: item.resource.cover,
					status: item.resource.status,
					visibility: item.resource.visibility,
				}
			: item.resource.presentation;
	const resource = item.resource;
	const isTagPath = presentation.kind === "tag_path";
	const title = isTagPath ? t.tags.paths.pathLabel : (presentation.title ?? t.create.list.untitled);
	const href = isTagPath
		? tagPathHref(resource.id)
		: studioContentHref(resource.section, {
				id: resource.id,
				slugAddress: presentation.slugAddress,
			});
	const activity =
		item.kind === "workspace"
			? item.resource.lastVisitedAt
				? { kind: "visited" as const, value: item.resource.lastVisitedAt }
				: { kind: "assigned" as const, value: item.resource.assignedAt }
			: item.resource.lastContributedAt
				? { kind: "participated" as const, value: item.resource.lastContributedAt }
				: {
						kind: "created" as const,
						value: item.resource.createdResourceAt ?? item.resource.lastParticipatedAt,
					};
	const contributionCount =
		item.kind === "contribution" ? toNonNegativeApiInteger(item.resource.contributionCount) : 0;
	const titleId = `studio-content-${resource.id}`;
	const showCover =
		presentation.kind === "localized_unit" &&
		studioContentShowsCover({ cover: presentation.cover, section: resource.section });

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
						fallback={<UnitCoverFallback kind={resource.section} />}
						sizes="(min-width: 640px) 96px, 80px"
						src={presentation.kind === "localized_unit" ? presentation.cover?.url : undefined}
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
					{presentation.kind === "tag_path" ? (
						<div className="mt-2" id={titleId}>
							<LinkOverlay asChild>
								<Link href={href} onClick={onOpen}>
									<span className="sr-only">{t.tags.paths.details}</span>
								</Link>
							</LinkOverlay>
							<TagPathPath
								ariaLabel={t.tags.paths.pathLabel}
								fallback={t.tags.paths.memberFallback}
								linkMembers={false}
								members={presentation.members}
								relationLabel={(kind) =>
									t.tags.expressions.relations[kind as keyof typeof t.tags.expressions.relations] ??
									t.tags.expressions.relationFallback
								}
							/>
						</div>
					) : (
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
					)}
					<div className="mt-3 flex flex-wrap gap-1.5">
						{presentation.kind === "tag_path" ? (
							<>
								<Badge size="sm" variant="secondary">
									{t.tags.paths.pathLabel}
								</Badge>
								<Badge size="sm" variant="outline">
									{t.create.list.immutable}
								</Badge>
							</>
						) : (
							<>
								<Badge size="sm" variant={statusVariant(presentation.status)}>
									{t.create.filters.statuses[presentation.status]}
								</Badge>
								<Badge size="sm" variant="outline">
									{t.create.filters.visibilities[presentation.visibility]}
								</Badge>
							</>
						)}
					</div>
					<div className="mt-3 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground text-xs">
						{item.kind === "workspace"
							? item.resource.accessSources.map((source) => (
									<span key={source}>{t.create.relations[source]}</span>
								))
							: null}
						{item.kind === "contribution" && item.resource.createdResourceAt ? (
							<span>{t.create.relations.created}</span>
						) : null}
						{item.kind === "contribution" && contributionCount > 0 ? (
							<>
								<span>{t.create.relations.contributed}</span>
								<span>{t.create.list.contributionCount({ count: contributionCount })}</span>
							</>
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
