"use client";

import {
	getApiProgressByUnitIdNodesQueryKey,
	type GetApiUnitsMediaByUnitIdContentStructureNodesStatus200,
	useDeleteApiProgressByUnitIdNodesByNodeId,
	useGetApiProgressByUnitIdNodes,
	useGetApiUnitsMediaByUnitIdContentStructureNodes,
	usePutApiProgressByUnitIdNodesByNodeId,
} from "@rezics/openapi-tanstack-query";
import { useQueryClient } from "@tanstack/react-query";
import {
	AudioLines,
	CheckCircle2,
	ChevronRight,
	ChevronsDownUp,
	ChevronsUpDown,
	Circle,
	Film,
	ListTree,
	Video,
} from "lucide-react";
import { useMemo, useState } from "react";

import { AppLink as Link } from "@/features/application-shell/components/app-link";
import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import { useLocalizationLanguages } from "@/i18n/use-localization-languages";
import { toNonNegativeApiInteger } from "@/lib/api-number";
import { useHydratedSession } from "@/lib/use-hydrated-session";
import { Button, cn, Skeleton } from "@rezics/ui";
import { buildContentStructureTree } from "../content-structure-tree";
import {
	collectBookStructureExpandableIds,
	flattenVisibleBookStructureTree,
} from "../model/book-content-structure-view";
import {
	BookContentStructureRowFrame,
	VirtualizedBookContentStructureRows,
} from "./book-content-structure-list";
import { unitDetailHref } from "../routing/unit-detail-routes";

type MediaNode = GetApiUnitsMediaByUnitIdContentStructureNodesStatus200["items"][number];

function formatDuration(value: string | number | null): string | undefined {
	if (value === null) return undefined;
	const seconds = toNonNegativeApiInteger(value);
	if (seconds <= 0) return undefined;
	const hours = Math.floor(seconds / 3600);
	const minutes = Math.floor((seconds % 3600) / 60);
	const remainder = seconds % 60;
	return hours
		? `${hours}:${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`
		: `${minutes}:${String(remainder).padStart(2, "0")}`;
}

export function MediaContents({ mediaId }: { readonly mediaId: string }) {
	const { t } = useTranslation(["actions", "state", "ui", "units"]);
	const { data: session } = useHydratedSession();
	const queryClient = useQueryClient();
	const localizationLanguages = useLocalizationLanguages();
	const structure = useGetApiUnitsMediaByUnitIdContentStructureNodes({
		path: { unitId: mediaId },
		query: { localizationLanguages },
	});
	const completion = useGetApiProgressByUnitIdNodes(
		{ path: { unitId: mediaId } },
		{ query: { enabled: Boolean(session) } },
	);
	const completeNode = usePutApiProgressByUnitIdNodesByNodeId();
	const uncompleteNode = useDeleteApiProgressByUnitIdNodesByNodeId();
	const [changingNodeId, setChangingNodeId] = useState<string>();
	const completedNodeIds = useMemo(
		() => new Set(completion.data?.items.map(({ nodeId }) => nodeId) ?? []),
		[completion.data],
	);

	async function toggleCompletion(nodeId: string) {
		setChangingNodeId(nodeId);
		try {
			if (completedNodeIds.has(nodeId))
				await uncompleteNode.mutateAsync({ path: { unitId: mediaId, nodeId } });
			else await completeNode.mutateAsync({ path: { unitId: mediaId, nodeId } });
			await queryClient.invalidateQueries({
				queryKey: getApiProgressByUnitIdNodesQueryKey({ path: { unitId: mediaId } }),
			});
		} catch {
			// The server projection remains the source of truth.
		} finally {
			setChangingNodeId(undefined);
		}
	}

	if (structure.isPending) return <Skeleton className="h-[42rem] rounded-xl" />;
	if (structure.isError)
		return (
			<section className="grid gap-3">
				<p className="text-sm text-destructive">{t.state.error}</p>
				<Button className="w-fit" onClick={() => void structure.refetch()} variant="outline">
					{t.actions.retry}
				</Button>
			</section>
		);

	return (
		<section className="grid gap-3" id="contents">
			<MediaContentsList
				changingNodeId={changingNodeId}
				completedNodeIds={completedNodeIds}
				completionDisabled={
					completion.isPending ||
					completion.isError ||
					completeNode.isPending ||
					uncompleteNode.isPending
				}
				items={structure.data?.items ?? []}
				onToggleCompletion={(nodeId) => void toggleCompletion(nodeId)}
				showCompletion={Boolean(session) && completion.isSuccess}
			/>
			<RequestFailure
				error={completion.error ?? completeNode.error ?? uncompleteNode.error}
				fallback={t.ui.retryLater}
			/>
		</section>
	);
}

function MediaContentsList({
	changingNodeId,
	completedNodeIds,
	completionDisabled,
	items,
	onToggleCompletion,
	showCompletion,
}: {
	readonly changingNodeId: string | undefined;
	readonly completedNodeIds: ReadonlySet<string>;
	readonly completionDisabled: boolean;
	readonly items: readonly MediaNode[];
	readonly onToggleCompletion: (nodeId: string) => void;
	readonly showCompletion: boolean;
}) {
	const { t } = useTranslation(["units"]);
	const tree = useMemo(() => buildContentStructureTree(items), [items]);
	const expandableIds = useMemo(() => collectBookStructureExpandableIds(tree), [tree]);
	const [expandedIds, setExpandedIds] = useState<ReadonlySet<string>>(() => new Set(expandableIds));
	const visibleEntries = useMemo(
		() => flattenVisibleBookStructureTree(tree, expandedIds),
		[expandedIds, tree],
	);
	const counts = useMemo(
		() =>
			items.reduce(
				(result, node) => ({
					...result,
					[node.contentKind]: result[node.contentKind] + 1,
				}),
				{ media: 0, video: 0, audio: 0, label: 0 },
			),
		[items],
	);

	function toggle(nodeId: string) {
		setExpandedIds((current) => {
			const next = new Set(current);
			if (next.has(nodeId)) next.delete(nodeId);
			else next.add(nodeId);
			return next;
		});
	}

	return (
		<section>
			<header className="flex flex-wrap items-end justify-between gap-4 border-b border-border-weak pb-4">
				<div className="min-w-0">
					<h2 className="font-heading text-lg font-semibold">{t.units.content.title}</h2>
					<p className="mt-1 text-sm text-muted-foreground">
						{t.units.content.mediaStructureSummary({
							videos: counts.video,
							audios: counts.audio,
							media: counts.media,
							labels: counts.label,
						})}
					</p>
				</div>
				<div className="flex flex-wrap items-center justify-end gap-2">
					<Button
						onClick={() => setExpandedIds(new Set(expandableIds))}
						type="button"
						variant="quiet"
					>
						<ChevronsUpDown aria-hidden />
						{t.units.content.expandAll}
					</Button>
					<Button onClick={() => setExpandedIds(new Set())} type="button" variant="quiet">
						<ChevronsDownUp aria-hidden />
						{t.units.content.collapseAll}
					</Button>
				</div>
			</header>
			{tree.length ? (
				<VirtualizedBookContentStructureRows
					entries={visibleEntries}
					label={t.units.content.title}
					renderRow={({ depth, entry, positionInSet, setSize }) => {
						const { node, children } = entry;
						const label = node.contentKind === "label";
						const expandable = children.length > 0;
						const expanded = expandedIds.has(node.id);
						const completed = completedNodeIds.has(node.id);
						const Icon =
							node.contentKind === "media"
								? Film
								: node.contentKind === "video"
									? Video
									: node.contentKind === "audio"
										? AudioLines
										: ListTree;
						const content = (
							<>
								<Icon aria-hidden className="size-5 shrink-0 text-muted-foreground" />
								<span className="min-w-0 flex-1">
									<span className="flex min-w-0 items-center gap-2">
										{label ? (
											<ChevronRight
												aria-hidden
												className={cn(
													"size-4 shrink-0 transition-transform",
													expanded && "rotate-90",
												)}
											/>
										) : null}
										<span className="truncate font-heading font-semibold">{node.title}</span>
									</span>
									<span className="mt-2 flex gap-4 text-sm text-muted-foreground">
										{label
											? t.units.content.childCount({ count: children.length })
											: (formatDuration(node.durationSeconds) ?? t.units.content.durationUnknown)}
									</span>
								</span>
							</>
						);
						return (
							<BookContentStructureRowFrame
								aria-expanded={expandable ? expanded : undefined}
								aria-level={depth + 1}
								aria-posinset={positionInSet}
								aria-setsize={setSize}
								depth={depth}
								role="treeitem"
							>
								{label ? (
									<button
										className="flex min-w-0 flex-1 items-center gap-3 self-stretch text-start"
										onClick={() => toggle(node.id)}
										type="button"
									>
										{content}
									</button>
								) : (
									<>
										{expandable ? (
											<Button
												aria-label={expanded ? t.units.content.collapse : t.units.content.expand}
												onClick={() => toggle(node.id)}
												size="icon-sm"
												type="button"
												variant="quiet"
											>
												<ChevronRight
													aria-hidden
													className={cn("transition-transform", expanded && "rotate-90")}
												/>
											</Button>
										) : null}
										<Link
											className="flex min-w-0 flex-1 items-center gap-3 self-stretch"
											href={
												node.contentKind === "media"
													? unitDetailHref("media", node.contentUnitId)
													: `/units/${node.contentKind}/${node.contentUnitId}`
											}
										>
											{content}
										</Link>
									</>
								)}
								{(node.contentKind === "video" || node.contentKind === "audio") &&
								showCompletion ? (
									<Button
										aria-label={
											completed
												? t.units.content.markMediaItemIncomplete
												: t.units.content.markMediaItemComplete
										}
										disabled={completionDisabled}
										isLoading={changingNodeId === node.id}
										onClick={() => onToggleCompletion(node.id)}
										size="icon-sm"
										type="button"
										variant="quiet"
									>
										{completed ? (
											<CheckCircle2 aria-hidden className="text-primary" />
										) : (
											<Circle aria-hidden />
										)}
									</Button>
								) : null}
							</BookContentStructureRowFrame>
						);
					}}
				/>
			) : (
				<div className="grid min-h-[36rem] place-items-center px-6 text-center">
					<p className="text-sm text-muted-foreground">{t.units.content.noMediaContent}</p>
				</div>
			)}
		</section>
	);
}
