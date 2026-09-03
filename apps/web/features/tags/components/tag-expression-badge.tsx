"use client";

import type { GetApiUnitsByTypeByUnitIdTagsStatus200 } from "@rezics/openapi-tanstack-query";
import { getApiTagsByTagIdPaths } from "@rezics/openapi-tanstack-query";
import {
	Badge,
	Button,
	Popover,
	PopoverBody,
	PopoverClose,
	PopoverContent,
	PopoverDescription,
	PopoverHeader,
	PopoverTitle,
	PopoverTrigger,
} from "@rezics/ui";
import { useInfiniteQuery } from "@tanstack/react-query";
import { ChevronRight, Search, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";

import { AppLink as Link } from "@/features/application-shell/components/app-link";
import { profileHref } from "@/features/profiles/profile-route";
import { useTranslation } from "@/i18n/client";
import { useLocalizationLanguages } from "@/i18n/use-localization-languages";
import type { RenderedTagExpression } from "../model/tag-expression-renderer";
import {
	compactTagExpressionTrail,
	presentTagExpressionTrail,
	type TagExpressionTrail,
} from "../model/tag-expression-trail";
import type { TaggableUnitType } from "../model/taggable-unit";
import { tagDetailHref, tagPathHref, tagSearchHref } from "../routing/tag-links";
import { TagPathPath } from "./tag-path";
import { TagVoteControls } from "./tag-vote-controls";

type UnitTagLandscape = GetApiUnitsByTypeByUnitIdTagsStatus200;
export type UnitExpressionApplication =
	UnitTagLandscape["expressions"][number]["applications"][number];
export type UnitRenderedExpression = RenderedTagExpression<UnitExpressionApplication>;

export function TagExpressionBadge({
	authorityLabel,
	authorityPrefix,
	canCurate,
	canVote,
	isPending,
	item,
	onClearJudgment,
	onRemoveApplication,
	onSpoilerChange,
	onVote,
	presentation = "label",
	type,
}: {
	readonly authorityLabel: string;
	readonly authorityPrefix?: string;
	readonly canCurate: boolean;
	readonly canVote: boolean;
	readonly isPending: (application: UnitExpressionApplication) => boolean;
	readonly item: UnitRenderedExpression;
	readonly onClearJudgment: (application: UnitExpressionApplication) => void;
	readonly onRemoveApplication: (application: UnitExpressionApplication) => void;
	readonly onSpoilerChange: (
		application: UnitExpressionApplication,
		value: 0 | 1 | 2 | null,
	) => void;
	readonly onVote: (application: UnitExpressionApplication, value: -1 | 1) => void;
	readonly presentation?: "label" | "path";
	readonly type: TaggableUnitType;
}) {
	const { t } = useTranslation(["tags", "ui"]);
	const localizationLanguages = useLocalizationLanguages();
	const [open, setOpen] = useState(false);
	const otherPositions = useInfiniteQuery({
		queryKey: ["tag-expression-other-positions", item.focusTagId, localizationLanguages],
		enabled: open,
		initialPageParam: null as string | null,
		queryFn: async ({ pageParam }) => {
			const response = await getApiTagsByTagIdPaths({
				path: { tagId: item.focusTagId },
				query: {
					localizationLanguages,
					limit: 10,
					...(pageParam ? { cursor: pageParam } : {}),
				},
				throwOnError: true,
			});
			return response.data;
		},
		getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
	});
	const adoptedPathIds = useMemo(
		() => new Set(item.applications.flatMap(({ pathId }) => (pathId ? [pathId] : []))),
		[item.applications],
	);
	const unadoptedPositions =
		otherPositions.data?.pages
			.flatMap(({ items }) => items)
			.filter(({ pathId }) => !adoptedPathIds.has(pathId)) ?? [];
	const positiveSource = item.applications.some(({ viewerVote }) => viewerVote === 1);
	const negativeSource = item.applications.some(({ viewerVote }) => viewerVote === -1);
	const trail = presentation === "path" ? presentTagExpressionTrail(item, t.tags.unnamedTag) : null;
	const expressionLabel = trail?.label ?? item.label;
	const visibleAuthorityPrefix =
		item.collisionRepair === "authority_relation" ? undefined : authorityPrefix;
	const displayLabel = visibleAuthorityPrefix
		? `${visibleAuthorityPrefix} · ${expressionLabel}`
		: expressionLabel;

	return (
		<Badge
			className="max-w-full gap-0 overflow-visible p-0"
			pill
			variant={positiveSource ? "success" : negativeSource ? "destructive" : "outline"}
		>
			<Popover
				autoFocus={false}
				closeOnEscape
				closeOnInteractOutside
				modal={false}
				onOpenChange={({ open: nextOpen }) => setOpen(nextOpen)}
				open={open}
				positioning={{ placement: "bottom-start", gutter: 8 }}
			>
				<PopoverTrigger asChild>
					<button
						aria-label={t.tags.expressions.open({
							expression: displayLabel,
							authority: authorityLabel,
						})}
						className="inline-flex min-w-0 max-w-full items-center gap-1.5 overflow-hidden rounded-full px-2.5 py-1.5 outline-none hover:bg-foreground/5 focus-visible:ring-2 focus-visible:ring-ring/40"
						type="button"
					>
						{trail ? (
							<TagExpressionTrailLabel authorityPrefix={visibleAuthorityPrefix} trail={trail} />
						) : (
							<span className="min-w-0 truncate">{item.label}</span>
						)}
						{item.applications.length > 1 ? (
							<span className="shrink-0 tabular-nums text-[0.6875rem] opacity-75">
								{item.applications.length}
							</span>
						) : null}
					</button>
				</PopoverTrigger>
				<PopoverContent className="max-h-[min(42rem,calc(100dvh-2rem))] w-[min(32rem,calc(100vw-2rem))] overflow-y-auto">
					<PopoverHeader className="pe-12">
						<PopoverTitle>{displayLabel}</PopoverTitle>
						<PopoverDescription>{authorityLabel}</PopoverDescription>
						<PopoverClose asChild>
							<Button
								aria-label={t.tags.expressions.close}
								className="absolute end-2 top-2"
								size="icon-sm"
								variant="quiet"
							>
								<X aria-hidden />
							</Button>
						</PopoverClose>
					</PopoverHeader>
					<PopoverBody className="grid gap-5">
						<section aria-labelledby={`${item.key}-applications`} className="grid gap-3">
							<div>
								<h3 className="font-medium" id={`${item.key}-applications`}>
									{t.tags.expressions.applicationsTitle}
								</h3>
								<p className="text-xs text-muted-foreground">
									{t.tags.expressions.applicationCount({ count: item.applications.length })}
								</p>
							</div>
							<ul className="grid gap-3">
								{item.applications.map((application, index) => (
									<li
										className="grid gap-3 rounded-lg border border-border-weak p-3"
										key={application.applicationId ?? `direct:${application.tagId}:${index}`}
									>
										<div className="flex items-center justify-between gap-2">
											<div className="flex flex-wrap items-center gap-2">
												<Badge variant="secondary">
													{application.sourceKind === "direct"
														? t.tags.expressions.directApplication
														: t.tags.expressions.pathApplication}
												</Badge>
												<div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
													<span>
														{t.tags.expressions.sourceDate({
															date: new Date(application.createdAt).toLocaleDateString(),
														})}
													</span>
													{application.createdByProfileId ? (
														<Link
															className="text-link hover:underline"
															href={profileHref(application.createdByProfileId)}
														>
															{t.tags.expressions.sourceContributor}
														</Link>
													) : null}
												</div>
											</div>
											{canCurate && application.sourceKind === "path" ? (
												<Button
													aria-label={t.tags.expressions.removeApplication}
													disabled={isPending(application)}
													onClick={() => onRemoveApplication(application)}
													size="icon-sm"
													variant="quiet"
												>
													<Trash2 aria-hidden />
												</Button>
											) : null}
										</div>
										{application.sourceKind === "path" ? (
											<details className="group grid gap-2">
												<summary className="flex cursor-pointer list-none items-center gap-1 text-sm font-medium">
													<ChevronRight
														aria-hidden
														className="size-4 transition-transform group-open:rotate-90"
													/>
													{t.tags.expressions.showCompletePath}
												</summary>
												<TagPathPath
													ariaLabel={t.tags.paths.pathLabel}
													fallback={t.tags.paths.memberFallback}
													members={application.members}
													relationLabel={(kind) => relationLabel(kind, t.tags.expressions)}
												/>
												{application.pathId ? (
													<Button asChild className="w-fit" size="sm" variant="quiet">
														<Link href={tagPathHref(application.pathId)}>
															{t.tags.paths.details}
														</Link>
													</Button>
												) : null}
											</details>
										) : null}
										<TagVoteControls
											canVote={canVote}
											isPending={isPending(application)}
											onClear={() => onClearJudgment(application)}
											onSpoilerChange={
												application.sourceKind === "path"
													? (value) => onSpoilerChange(application, value)
													: undefined
											}
											onVote={(value) => onVote(application, value)}
											score={Number(application.score)}
											viewerVote={application.viewerVote}
											viewerSpoilerLevel={application.viewerSpoilerLevel}
											voteCount={Number(application.voteCount)}
										/>
										{Number(application.spoilerVoteCount) > 0 ? (
											<p className="text-xs text-muted-foreground">
												{t.tags.paths.spoilerSummary({
													none: Number(application.spoilerDistribution.none),
													minor: Number(application.spoilerDistribution.minor),
													major: Number(application.spoilerDistribution.major),
												})}
											</p>
										) : null}
									</li>
								))}
							</ul>
						</section>

						{unadoptedPositions.length || otherPositions.hasNextPage ? (
							<details className="group grid gap-3 border-t border-border-weak pt-4">
								<summary className="flex cursor-pointer list-none items-center gap-1 font-medium">
									<ChevronRight
										aria-hidden
										className="size-4 transition-transform group-open:rotate-90"
									/>
									{t.tags.expressions.otherPositionsTitle}
								</summary>
								<p className="text-xs text-muted-foreground">
									{t.tags.expressions.otherPositionsDescription}
								</p>
								<ul className="grid gap-3">
									{unadoptedPositions.map((position) => (
										<li className="grid gap-2" key={position.pathId}>
											<TagPathPath
												ariaLabel={t.tags.paths.pathLabel}
												fallback={t.tags.paths.memberFallback}
												members={position.members}
												relationLabel={(kind) => relationLabel(kind, t.tags.expressions)}
											/>
										</li>
									))}
								</ul>
								{otherPositions.hasNextPage ? (
									<Button
										className="w-fit"
										isLoading={otherPositions.isFetchingNextPage}
										onClick={() => void otherPositions.fetchNextPage()}
										size="sm"
										variant="outline"
									>
										{t.ui.showMore}
									</Button>
								) : null}
							</details>
						) : null}

						<div className="flex flex-wrap gap-1 border-t border-border-weak pt-3">
							<Button asChild size="sm" variant="quiet">
								<Link href={tagDetailHref(item.focusTagId)}>{t.tags.card.details}</Link>
							</Button>
							<Button asChild size="sm" variant="quiet">
								<Link href={tagSearchHref(type, [{ tagId: item.focusTagId, label: item.label }])}>
									<Search aria-hidden />
									{t.tags.card.search}
								</Link>
							</Button>
						</div>
					</PopoverBody>
				</PopoverContent>
			</Popover>
		</Badge>
	);
}

function TagExpressionTrailLabel({
	authorityPrefix,
	trail,
}: {
	readonly authorityPrefix?: string;
	readonly trail: TagExpressionTrail;
}) {
	return (
		<span aria-hidden className="inline-flex min-w-0 max-w-full items-center gap-1">
			{authorityPrefix ? (
				<>
					<span className="max-w-36 shrink truncate font-medium">{authorityPrefix}</span>
					<span className="shrink-0 opacity-45">·</span>
				</>
			) : null}
			<span className="inline-flex min-w-0 items-center gap-1 sm:hidden">
				<TagExpressionTrailParts trail={trail} maximumParts={3} />
			</span>
			<span className="hidden min-w-0 items-center gap-1 sm:inline-flex">
				<TagExpressionTrailParts trail={trail} maximumParts={4} />
			</span>
		</span>
	);
}

function TagExpressionTrailParts({
	maximumParts,
	trail,
}: {
	readonly maximumParts: 3 | 4;
	readonly trail: TagExpressionTrail;
}) {
	const parts = compactTagExpressionTrail(trail.segments, maximumParts);
	return parts.map((part, index) => (
		<span className="contents" key={part.kind === "ellipsis" ? part.key : part.segment.key}>
			{index ? <span className="shrink-0 opacity-45">›</span> : null}
			{part.kind === "ellipsis" ? (
				<span className="shrink-0 opacity-70">…</span>
			) : (
				<span
					className={
						index === parts.length - 1
							? "min-w-0 max-w-48 truncate font-semibold"
							: "max-w-36 shrink truncate opacity-70"
					}
				>
					{part.segment.label}
				</span>
			)}
		</span>
	));
}

function relationLabel(
	relation: string,
	copy: {
		readonly relationFallback: string;
		readonly relations: Readonly<Record<string, string>>;
	},
): string {
	return copy.relations[relation] ?? copy.relationFallback;
}
