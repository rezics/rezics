"use client";

import {
	getApiProgressByUnitIdNodesQueryKey,
	type GetApiUnitsBookByUnitIdContentStructureNodesStatus200,
	useDeleteApiProgressByUnitIdNodesByNodeId,
	useGetApiProgressByUnitIdNodes,
	useGetApiUnitsBookByUnitIdContentStructureNodes,
	usePutApiProgressByUnitIdNodesByNodeId,
} from "@rezics/openapi-tanstack-query";
import { useQueryClient } from "@tanstack/react-query";
import {
	CheckIcon,
	ChevronRight,
	ChevronsDownUp,
	ChevronsUpDown,
	CircleIcon,
	Ellipsis,
	LibraryIcon,
	Share2,
} from "lucide-react";
import { AppLink as Link } from "@/features/application-shell/components/app-link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Button, Menu, MenuContent, MenuItem, MenuTrigger, Skeleton } from "@rezics/ui";
import { useAuthPortal } from "@/features/auth/auth-portal-context";
import { CollectionPickerButton } from "@/features/collections/components/collection-picker-button";
import { useTranslation } from "@/i18n/client";
import { useLocalizationLanguages } from "@/i18n/use-localization-languages";
import { RequestFailure } from "@/i18n/request-failure";
import { toNonNegativeApiInteger } from "@/lib/api-number";
import { useHydratedSession } from "@/lib/use-hydrated-session";
import { buildContentStructureTree } from "../content-structure-tree";
import { bookReaderHref, unitDetailHref } from "../routing/unit-detail-routes";
import {
	collectBookStructureExpandableIds,
	countBookStructureDisplayedKinds,
	EmptyBookStructureContentMetrics,
	flattenVisibleBookStructureTree,
	indexBookStructureSubtreeContentMetrics,
	isBookStructureDisplayLabel,
	type BookStructureContentMetrics,
} from "../model/book-content-structure-view";
import {
	BookContentStructureChapterViewMetric,
	BookContentStructureRowFrame,
	BookContentStructureRowText,
	BookContentStructureSection,
	EmptyBookContentStructureList,
	VirtualizedBookContentStructureRows,
} from "./book-content-structure-list";
import { UnitShareDialog } from "./unit-share-action";

type BookStructureResponse = GetApiUnitsBookByUnitIdContentStructureNodesStatus200;
type BookStructureNode = BookStructureResponse["items"][number];

type ShareTarget = {
	readonly href: string;
	readonly unitId: string;
};

export function BookContents({ bookId }: { readonly bookId: string }) {
	const { t } = useTranslation(["actions", "state", "ui", "units"]);
	const { data: session } = useHydratedSession();
	const queryClient = useQueryClient();
	const localizationLanguages = useLocalizationLanguages();
	const structure = useGetApiUnitsBookByUnitIdContentStructureNodes({
		path: { unitId: bookId },
		query: { localizationLanguages },
	});
	const completion = useGetApiProgressByUnitIdNodes(
		{ path: { unitId: bookId } },
		{ query: { enabled: Boolean(session) } },
	);
	const completeNode = usePutApiProgressByUnitIdNodesByNodeId();
	const uncompleteNode = useDeleteApiProgressByUnitIdNodesByNodeId();
	const [changingNodeId, setChangingNodeId] = useState<string>();
	const completedNodeIds = useMemo(
		() => new Set(completion.data?.items.map(({ nodeId }) => nodeId) ?? []),
		[completion.data],
	);

	async function toggleNodeCompletion(nodeId: string) {
		const completed = completedNodeIds.has(nodeId);
		setChangingNodeId(nodeId);
		try {
			if (completed) await uncompleteNode.mutateAsync({ path: { unitId: bookId, nodeId } });
			else await completeNode.mutateAsync({ path: { unitId: bookId, nodeId } });
			await queryClient.invalidateQueries({
				queryKey: getApiProgressByUnitIdNodesQueryKey({
					path: { unitId: bookId },
				}),
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
				<p className="text-destructive text-sm">{t.state.error}</p>
				<Button className="w-fit" onClick={() => void structure.refetch()} variant="outline">
					{t.actions.retry}
				</Button>
			</section>
		);

	return (
		<section className="grid gap-3" id="contents">
			<BookContentsList
				authenticated={Boolean(session)}
				bookId={bookId}
				changingNodeId={changingNodeId}
				completedNodeIds={completedNodeIds}
				completionDisabled={
					completion.isPending ||
					completion.isError ||
					completeNode.isPending ||
					uncompleteNode.isPending
				}
				items={structure.data?.items ?? []}
				onToggleCompletion={(nodeId) => void toggleNodeCompletion(nodeId)}
				showCompletion={Boolean(session) && completion.isSuccess}
			/>
			<RequestFailure
				error={completion.error ?? completeNode.error ?? uncompleteNode.error}
				fallback={t.ui.retryLater}
			/>
		</section>
	);
}

function BookContentsList({
	authenticated,
	bookId,
	changingNodeId,
	completedNodeIds,
	completionDisabled,
	items,
	onToggleCompletion,
	showCompletion,
}: {
	readonly authenticated: boolean;
	readonly bookId: string;
	readonly changingNodeId: string | undefined;
	readonly completedNodeIds: ReadonlySet<string>;
	readonly completionDisabled: boolean;
	readonly items: readonly BookStructureNode[];
	readonly onToggleCompletion: (nodeId: string) => void;
	readonly showCompletion: boolean;
}) {
	const { t } = useTranslation(["feed", "units"]);
	const { openAuthPortal } = useAuthPortal();
	const tree = useMemo(() => buildContentStructureTree(items), [items]);
	const nodeById = useMemo(() => new Map(items.map((node) => [node.id, node] as const)), [items]);
	const allExpandableIds = useMemo(() => collectBookStructureExpandableIds(tree), [tree]);
	const [expandedIds, setExpandedIds] = useState<ReadonlySet<string>>(
		() => new Set(allExpandableIds),
	);
	const [scrollTargetId, setScrollTargetId] = useState<string>();
	const [shareTarget, setShareTarget] = useState<ShareTarget>();
	const [collectionTargetId, setCollectionTargetId] = useState<string>();
	const visibleEntries = useMemo(
		() => flattenVisibleBookStructureTree(tree, expandedIds),
		[expandedIds, tree],
	);
	const ownContentMetricsByNodeId = useMemo(() => indexOwnContentMetrics(items), [items]);
	const contentMetricsByNodeId = useMemo(
		() => indexBookStructureSubtreeContentMetrics(tree, ownContentMetricsByNodeId),
		[ownContentMetricsByNodeId, tree],
	);
	const { bookCount, chapterCount, labelCount } = useMemo(
		() => countBookStructureDisplayedKinds(tree),
		[tree],
	);
	const clearScrollTarget = useCallback(() => setScrollTargetId(undefined), []);

	useEffect(() => {
		function revealHashTarget() {
			const prefix = "#content-node-";
			if (!window.location.hash.startsWith(prefix)) return;
			let nodeId: string;
			try {
				nodeId = decodeURIComponent(window.location.hash.slice(prefix.length));
			} catch {
				return;
			}
			const node = nodeById.get(nodeId);
			if (!node) return;
			const ancestors = new Set<string>();
			let parentId = node.parentId;
			while (parentId && !ancestors.has(parentId)) {
				ancestors.add(parentId);
				parentId = nodeById.get(parentId)?.parentId ?? null;
			}
			setExpandedIds((current) => new Set([...current, ...ancestors]));
			setScrollTargetId(nodeId);
		}
		revealHashTarget();
		window.addEventListener("hashchange", revealHashTarget);
		return () => window.removeEventListener("hashchange", revealHashTarget);
	}, [nodeById]);

	function toggle(nodeId: string) {
		setExpandedIds((current) => {
			const next = new Set(current);
			if (next.has(nodeId)) next.delete(nodeId);
			else next.add(nodeId);
			return next;
		});
	}

	function requestCollection(targetId: string) {
		if (!authenticated) {
			openAuthPortal("login");
			return;
		}
		setCollectionTargetId(targetId);
	}

	return (
		<>
			<BookContentStructureSection
				actions={
					<>
						<Button
							onClick={() => setExpandedIds(new Set(allExpandableIds))}
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
					</>
				}
				bookCount={bookCount}
				chapterCount={chapterCount}
				labelCount={labelCount}
			>
				{tree.length ? (
					<VirtualizedBookContentStructureRows
						entries={visibleEntries}
						label={t.units.content.title}
						onScrollToNode={clearScrollTarget}
						renderRow={({ depth, entry, positionInSet, setSize }) => {
							const { node, children } = entry;
							const displayAsLabel = isBookStructureDisplayLabel(entry);
							const expandable = children.length > 0;
							const expanded = expandedIds.has(node.id);
							const completed = completedNodeIds.has(node.id);
							const mainClassName =
								"flex min-w-0 flex-1 items-center gap-3 self-stretch text-start outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring";
							const rowText = (
								<BookContentStructureRowText
									contentMetrics={
										contentMetricsByNodeId.get(node.id) ?? EmptyBookStructureContentMetrics
									}
									directChildCount={children.length}
									expanded={expanded}
									label={displayAsLabel}
									language={node.language}
									metadataAfter={
										displayAsLabel ? null : (
											<BookContentStructureChapterViewMetric label={t.units.content.views} />
										)
									}
									title={node.title}
								/>
							);
							return (
								<BookContentStructureRowFrame
									aria-expanded={expandable ? expanded : undefined}
									aria-level={depth + 1}
									aria-posinset={positionInSet}
									aria-setsize={setSize}
									depth={depth}
									id={`content-node-${node.id}`}
									role="treeitem"
								>
									{displayAsLabel ? (
										<button className={mainClassName} onClick={() => toggle(node.id)} type="button">
											{rowText}
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
														className={
															expanded ? "rotate-90 transition-transform" : "transition-transform"
														}
													/>
												</Button>
											) : null}
											<Link
												className={mainClassName}
												href={
													node.contentKind === "book"
														? unitDetailHref("book", node.contentUnitId)
														: bookReaderHref(bookId, node.id)
												}
											>
												{rowText}
											</Link>
										</>
									)}
									{showCompletion && node.contentKind === "chapter" ? (
										<Button
											aria-label={
												completed
													? t.units.reader.markChapterIncomplete
													: t.units.reader.markChapterComplete
											}
											aria-pressed={completed}
											disabled={completionDisabled}
											isLoading={changingNodeId === node.id}
											onClick={() => onToggleCompletion(node.id)}
											size="sm"
											variant={completed ? "secondary" : "quiet"}
										>
											{completed ? <CheckIcon aria-hidden /> : <CircleIcon aria-hidden />}
											<span className="hidden sm:inline">
												{completed ? t.units.reader.read : t.units.reader.unread}
											</span>
										</Button>
									) : null}
									<Menu>
										<MenuTrigger asChild>
											<Button
												aria-label={t.units.content.actions}
												size="icon-sm"
												type="button"
												variant="quiet"
											>
												<Ellipsis aria-hidden />
											</Button>
										</MenuTrigger>
										<MenuContent>
											<MenuItem
												onSelect={() =>
													setShareTarget({
														href: displayAsLabel
															? `/units/book/${bookId}/contents#content-node-${encodeURIComponent(node.id)}`
															: node.contentKind === "book"
																? unitDetailHref("book", node.contentUnitId)
																: bookReaderHref(bookId, node.id),
														unitId: node.contentUnitId,
													})
												}
												value={`share-${node.id}`}
											>
												<Share2 aria-hidden />
												{t.feed.actions.shareTitle}
											</MenuItem>
											<MenuItem
												onSelect={() => requestCollection(node.contentUnitId)}
												value={`collection-${node.id}`}
											>
												<LibraryIcon aria-hidden />
												{t.feed.actions.addToCollection}
											</MenuItem>
										</MenuContent>
									</Menu>
								</BookContentStructureRowFrame>
							);
						}}
						scrollToNodeId={scrollTargetId}
					/>
				) : (
					<EmptyBookContentStructureList />
				)}
			</BookContentStructureSection>
			{shareTarget ? (
				<UnitShareDialog
					href={shareTarget.href}
					onOpenChange={(open) => {
						if (!open) setShareTarget(undefined);
					}}
					open
					unitId={shareTarget.unitId}
				/>
			) : null}
			{collectionTargetId ? (
				<CollectionPickerButton
					onOpenChange={(open) => {
						if (!open) setCollectionTargetId(undefined);
					}}
					open
					targetId={collectionTargetId}
				/>
			) : null}
		</>
	);
}

function indexOwnContentMetrics(
	nodes: readonly BookStructureNode[],
): ReadonlyMap<string, BookStructureContentMetrics> {
	return new Map(
		nodes.map((node) => [
			node.id,
			{
				wordCount: toNonNegativeApiInteger(node.contentMetrics.wordCount),
				characterCount: toNonNegativeApiInteger(node.contentMetrics.characterCount),
			},
		]),
	);
}
