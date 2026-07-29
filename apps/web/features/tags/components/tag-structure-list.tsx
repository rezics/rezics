"use client";

import type { GetApiUnitsByTypeByUnitIdTagsStatus200 } from "@rezics/openapi-tanstack-query";
import { Button, Card, CardContent } from "@rezics/ui";
import { ChevronRight } from "lucide-react";
import { AppLink as Link } from "@/features/application-shell/components/app-link";

import type { CatalogDetailUnitType } from "@/features/units/model/catalog-detail-section";
import { useTranslation } from "@/i18n/client";
import { toFiniteApiNumber, toNonNegativeApiInteger } from "@/lib/api-number";
import type { TagPresentation } from "../model/tag-presentation";
import { tagStructureHref } from "../routing/tag-links";
import { TagBadgeCard } from "./tag-badge-card";
import { TagVoteControls } from "./tag-vote-controls";

type TagStructure = GetApiUnitsByTypeByUnitIdTagsStatus200["structures"][number];

export function presentStructureMembers(structure: TagStructure): readonly TagPresentation[] {
	return structure.members.map((member) => ({
		itemKey: `structure:${structure.structureId}:${member.tagId}`,
		identity: {
			tagId: member.tagId,
			language: member.language,
			title: member.title,
			summary: member.summary,
		},
		context: { kind: "structure", structureId: structure.structureId },
		vote: { kind: "not-applicable", reason: "structure-member" },
	}));
}

export function TagStructureList({
	canVote,
	isPending,
	onClearStructureVote,
	onClearTagVote,
	onStructureVote,
	onTagVote,
	onToggleSelected,
	selectedTagIds,
	selectionMode,
	structures,
	surface,
	type,
}: {
	readonly canVote: boolean;
	readonly isPending: (structureId: string) => boolean;
	readonly onClearStructureVote: (structureId: string) => void;
	readonly onClearTagVote: (item: TagPresentation) => void;
	readonly onStructureVote: (structureId: string, value: -1 | 1) => void;
	readonly onTagVote: (item: TagPresentation, value: -1 | 1) => void;
	readonly onToggleSelected: (tagId: string, label: string) => void;
	readonly selectedTagIds: ReadonlySet<string>;
	readonly selectionMode: boolean;
	readonly structures: readonly TagStructure[];
	readonly surface: "section" | "page";
	readonly type: CatalogDetailUnitType;
}) {
	const { t } = useTranslation(["tags"]);
	if (!structures.length) {
		return <p className="text-sm text-muted-foreground">{t.tags.structures.empty}</p>;
	}
	return (
		<div className="grid gap-3">
			{structures.map((structure) => {
				const members = presentStructureMembers(structure);
				const content = (
					<div className="grid gap-3">
						<ol
							aria-label={t.tags.structures.pathLabel}
							className="flex flex-wrap items-center gap-1.5"
						>
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
						<div className="flex flex-wrap items-center justify-between gap-3">
							{surface === "page" ? (
								<TagVoteControls
									canVote={canVote}
									isPending={isPending(structure.structureId)}
									onClear={() => onClearStructureVote(structure.structureId)}
									onVote={(value) =>
										onStructureVote(structure.structureId, value)
									}
									score={toFiniteApiNumber(structure.score) ?? 0}
									viewerVote={structure.viewerVote}
									voteCount={toNonNegativeApiInteger(structure.voteCount)}
								/>
							) : (
								<span />
							)}
							<Button asChild size="sm" variant="quiet">
								<Link href={tagStructureHref(structure.structureId)}>
									{t.tags.structures.details}
								</Link>
							</Button>
						</div>
					</div>
				);
				return surface === "page" ? (
					<Card key={structure.structureId}>
						<CardContent className="p-4 sm:p-5">{content}</CardContent>
					</Card>
				) : (
					<div
						className="border-t border-border-weak pt-3 first:border-0 first:pt-0"
						key={structure.structureId}
					>
						{content}
					</div>
				);
			})}
		</div>
	);
}
