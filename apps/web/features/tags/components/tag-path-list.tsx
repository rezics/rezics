"use client";

import type { GetApiUnitsByTypeByUnitIdTagsStatus200 } from "@rezics/openapi-tanstack-query";
import { Button, Card, CardContent, RadioGroup, RadioGroupItem, RadioGroupLabel } from "@rezics/ui";
import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { AppLink as Link } from "@/features/application-shell/components/app-link";

import type { UnitDetailUnitType } from "@/features/units/model/unit-detail-section";
import { useTranslation } from "@/i18n/client";
import { toFiniteApiNumber, toNonNegativeApiInteger } from "@/lib/api-number";
import type { TagPresentation } from "../model/tag-presentation";
import { tagPathHref } from "../routing/tag-links";
import { TagBadgeCard } from "./tag-badge-card";
import { TagVoteControls } from "./tag-vote-controls";

type TagPath = GetApiUnitsByTypeByUnitIdTagsStatus200["paths"][number];

export function presentPathMembers(path: TagPath): readonly TagPresentation[] {
	return path.members.map((member) => ({
		itemKey: `path:${path.pathId}:${member.tagId}`,
		identity: {
			tagId: member.tagId,
			language: member.language,
			title: member.title,
			summary: member.summary,
			avatar: member.avatar,
		},
		context: { kind: "path", pathId: path.pathId },
		vote: { kind: "not-applicable", reason: "path-member" },
	}));
}

export function TagPathList({
	canVote,
	isPending,
	onClearPathJudgment,
	onClearTagVote,
	onPathJudgment,
	onTagVote,
	onToggleSelected,
	selectedTagIds,
	selectionMode,
	paths,
	surface,
	type,
	renderMeta,
}: {
	readonly canVote: boolean;
	readonly isPending: (pathId: string) => boolean;
	readonly onClearPathJudgment: (pathId: string) => void;
	readonly onClearTagVote: (item: TagPresentation) => void;
	readonly onPathJudgment: (
		pathId: string,
		judgment: { fitVote?: -1 | 1; spoilerLevel?: 0 | 1 | 2 },
	) => void;
	readonly onTagVote: (item: TagPresentation, value: -1 | 1) => void;
	readonly onToggleSelected: (tagId: string, label: string) => void;
	readonly selectedTagIds: ReadonlySet<string>;
	readonly selectionMode: boolean;
	readonly paths: readonly TagPath[];
	readonly surface: "section" | "page";
	readonly type: UnitDetailUnitType;
	readonly renderMeta?: (pathId: string) => ReactNode;
}) {
	const { t } = useTranslation(["tags"]);
	if (!paths.length) {
		return <p className="text-sm text-muted-foreground">{t.tags.paths.empty}</p>;
	}
	return (
		<div className="grid gap-3">
			{paths.map((path) => {
				const members = presentPathMembers(path);
				const content = (
					<div className="grid gap-3">
						<ol aria-label={t.tags.paths.pathLabel} className="flex flex-wrap items-center gap-1.5">
							{members.map((item, index) => (
								<li className="contents" key={item.itemKey}>
									{index > 0 ? (
										<ChevronRight
											aria-hidden
											className="size-4 shrink-0 text-muted-foreground rtl:rotate-180"
										/>
									) : null}
									<TagBadgeCard
										fallbackLabel={t.tags.unnamedTag}
										isPending={false}
										item={item}
										onClearVote={onClearTagVote}
										onToggleSelected={onToggleSelected}
										onVote={onTagVote}
										selected={selectedTagIds.has(item.identity.tagId)}
										selectionMode={selectionMode}
										type={type}
									/>
								</li>
							))}
						</ol>
						<div className="grid gap-3">
							{renderMeta?.(path.pathId)}
							{surface === "page" ? (
								<>
									<div className="grid gap-1">
										<p className="text-sm font-medium">{t.tags.paths.fitLabel}</p>
										<TagVoteControls
											canVote={canVote}
											isPending={isPending(path.pathId)}
											onClear={() => onClearPathJudgment(path.pathId)}
											onVote={(fitVote) => onPathJudgment(path.pathId, { fitVote })}
											score={toFiniteApiNumber(path.score) ?? 0}
											viewerVote={path.viewerVote}
											voteCount={toNonNegativeApiInteger(path.voteCount)}
										/>
									</div>
									<RadioGroup
										disabled={!canVote || isPending(path.pathId)}
										onValueChange={({ value }) => {
											const spoilerLevel = Number(value);
											if (spoilerLevel === 0 || spoilerLevel === 1 || spoilerLevel === 2)
												onPathJudgment(path.pathId, { spoilerLevel });
										}}
										value={
											path.viewerSpoilerLevel === null ? undefined : String(path.viewerSpoilerLevel)
										}
									>
										<RadioGroupLabel>{t.tags.paths.spoilerLabel}</RadioGroupLabel>
										<div className="flex flex-wrap gap-3">
											<RadioGroupItem value="0">{t.tags.paths.spoilerNone}</RadioGroupItem>
											<RadioGroupItem value="1">{t.tags.paths.spoilerMinor}</RadioGroupItem>
											<RadioGroupItem value="2">{t.tags.paths.spoilerMajor}</RadioGroupItem>
										</div>
										<p className="text-xs text-muted-foreground">
											{t.tags.paths.spoilerSummary({
												none: toNonNegativeApiInteger(path.spoilerDistribution.none),
												minor: toNonNegativeApiInteger(path.spoilerDistribution.minor),
												major: toNonNegativeApiInteger(path.spoilerDistribution.major),
											})}
										</p>
									</RadioGroup>
								</>
							) : (
								<span />
							)}
							<Button asChild className="w-fit" size="sm" variant="quiet">
								<Link href={tagPathHref(path.pathId)}>{t.tags.paths.details}</Link>
							</Button>
						</div>
					</div>
				);
				return surface === "page" ? (
					<Card key={path.pathId}>
						<CardContent className="p-4 sm:p-5">{content}</CardContent>
					</Card>
				) : (
					<div
						className="border-t border-border-weak pt-3 first:border-0 first:pt-0"
						key={path.pathId}
					>
						{content}
					</div>
				);
			})}
		</div>
	);
}
