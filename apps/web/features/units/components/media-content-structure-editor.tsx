"use client";

import { toContentLanguage } from "@rezics/i18n";
import {
	type GetApiUnitsMediaByUnitIdContentStructureNodesStatus200,
	type PutApiUnitsMediaByUnitIdContentStructureBody,
	usePutApiUnitsMediaByUnitIdContentStructure,
} from "@rezics/openapi-tanstack-query";
import { useQueryClient } from "@tanstack/react-query";
import {
	ArrowDownToLine,
	ArrowUpToLine,
	AudioLines,
	ChevronRight,
	ChevronsDownUp,
	ChevronsUpDown,
	Ellipsis,
	Film,
	GripVertical,
	HistoryIcon,
	ListTree,
	Move,
	Pencil,
	Plus,
	Save,
	Square,
	SquareCheckBig,
	Undo2,
	Video,
} from "lucide-react";
import { type DragEvent, type MouseEvent, useMemo, useState } from "react";

import { AppLink as Link } from "@/features/application-shell/components/app-link";
import { useApplicationRouter } from "@/features/application-shell/hooks/use-application-router";
import {
	Badge,
	Button,
	cn,
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuTrigger,
	Dialog,
	DialogBody,
	DialogClose,
	DialogContent,
	DialogFooter,
	DialogHeader,
	Field,
	FieldLabel,
	Input,
	Menu,
	MenuContent,
	MenuItem,
	MenuTrigger,
} from "@rezics/ui";
import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import { toNonNegativeApiInteger } from "@/lib/api-number";
import { invalidateMediaContentStructure } from "../unit-cache";
import {
	addMediaDraftNode,
	addMediaDraftNodeAfter,
	buildMediaDraftTree,
	createMediaContentStructureDraft,
	findLastMediaDraftLabelId,
	getMediaDraftMoveTargetIds,
	indexMediaDraftSelectionCoverage,
	isMediaDraftParentTarget,
	mediaContentStructureDraftFingerprint,
	moveMediaDraftSelection,
	moveMediaDraftSelectionToSiblingEdge,
	normalizeMediaDraftSelectionIds,
	renameMediaDraftNode,
	toMediaContentStructureSaveNodes,
	type MediaDraftDropTarget,
	type MediaDraftNode,
} from "../model/media-content-structure-draft";
import {
	flattenVisibleBookStructureTree,
	type VisibleBookStructureTreeNode,
} from "../model/book-content-structure-view";
import { contentStructureHistoryHref, unitManagementHref } from "../routing/unit-management-routes";
import {
	BookContentStructureRowFrame,
	VirtualizedBookContentStructureRows,
} from "./book-content-structure-list";
import {
	contentStructureDestinationForNode,
	ContentStructureDestinationDialog,
	type ContentStructureDestination,
} from "./book-content-structure-destination-dialog";
import {
	MediaContentNodeDialog,
	type MediaContentNodeDialogRequest,
	type MediaContentNodeDialogSubmission,
} from "./media-content-node-dialog";
import { UnitSectionHeader } from "./unit-section-header";

type MediaStructureResponse = GetApiUnitsMediaByUnitIdContentStructureNodesStatus200;
type MediaStructureDraftBase = PutApiUnitsMediaByUnitIdContentStructureBody["base"];

type EditorDocument = {
	readonly base: MediaStructureDraftBase;
	readonly baseline: readonly MediaDraftNode[];
	readonly draft: readonly MediaDraftNode[];
};

type CreatePlacement = {
	readonly parentId: string | null;
	readonly insertAfterId?: string;
};

type ActiveDropTarget = MediaDraftDropTarget | undefined;

const EmptyIdSet: ReadonlySet<string> = new Set();

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

export function MediaContentStructureEditor({
	initial,
	mediaId,
}: {
	readonly initial: MediaStructureResponse;
	readonly mediaId: string;
}) {
	const { t, locale } = useTranslation(["engagement", "units", "ui"]);
	const router = useApplicationRouter();
	const queryClient = useQueryClient();
	const [document, setDocument] = useState<EditorDocument>(() => {
		const initialDraft = createMediaContentStructureDraft(initial.items);
		return {
			base:
				initial.state === "initialized"
					? { kind: "revision", revisionId: initial.latestRevisionId }
					: { kind: "uninitialized" },
			baseline: initialDraft,
			draft: initialDraft,
		};
	});
	const [createRequest, setCreateRequest] = useState<MediaContentNodeDialogRequest>();
	const save = usePutApiUnitsMediaByUnitIdContentStructure();
	const draftFingerprint = useMemo(
		() => mediaContentStructureDraftFingerprint(document.draft),
		[document.draft],
	);
	const baselineFingerprint = useMemo(
		() => mediaContentStructureDraftFingerprint(document.baseline),
		[document.baseline],
	);
	const dirty = draftFingerprint !== baselineFingerprint;

	async function saveDraft(draft: readonly MediaDraftNode[] = document.draft) {
		const changed = mediaContentStructureDraftFingerprint(draft) !== baselineFingerprint;
		if (!changed || save.isPending) return undefined;
		try {
			const saved = await save.mutateAsync({
				path: { unitId: mediaId },
				body: {
					base: document.base,
					nodes: toMediaContentStructureSaveNodes(draft),
				},
			});
			const savedDraft = createMediaContentStructureDraft(saved.items);
			setDocument({
				base: { kind: "revision", revisionId: saved.latestRevisionId },
				baseline: savedDraft,
				draft: savedDraft,
			});
			void invalidateMediaContentStructure(queryClient, mediaId);
			return saved;
		} catch {
			return undefined;
		}
	}

	async function submitNode(submission: MediaContentNodeDialogSubmission) {
		if (save.isPending) return;
		const placement = resolveCreatePlacement(document.draft, submission.destination);
		if (!placement) return;
		const common = {
			id: crypto.randomUUID(),
			parentId: placement.parentId,
			language: toContentLanguage(locale.target),
			durationSeconds: null,
		};
		const node =
			submission.mode === "attach"
				? {
						...common,
						state: "attached" as const,
						title: submission.unit.label,
						contentKind: submission.unit.kind,
						contentUnitId: submission.unit.id,
					}
				: {
						...common,
						state: "new" as const,
						title: submission.title,
						contentKind: submission.contentKind,
					};
		const nextDraft = placement.insertAfterId
			? addMediaDraftNodeAfter(document.draft, node, placement.insertAfterId)
			: addMediaDraftNode(document.draft, node);
		const saved = await saveDraft(nextDraft);
		if (saved) setCreateRequest(undefined);
	}

	async function openMediaItem(nodeId: string) {
		const node = document.draft.find(({ id }) => id === nodeId);
		if (!node || node.contentKind === "label" || save.isPending) return;
		let contentUnitId = node.state === "new" ? undefined : node.contentUnitId;
		if (dirty) {
			const saved = await saveDraft();
			contentUnitId = saved?.items.find(({ id }) => id === nodeId)?.contentUnitId;
		}
		if (contentUnitId) router.push(unitManagementHref(node.contentKind, contentUnitId));
	}

	return (
		<section>
			<UnitSectionHeader
				action={
					<>
						<Button
							aria-label={t.units.content.discardDraft}
							disabled={!dirty || save.isPending}
							onClick={() =>
								setDocument((current) => ({ ...current, draft: current.baseline }))
							}
							size="icon-md"
							type="button"
							variant="outline"
						>
							<Undo2 aria-hidden />
						</Button>
						<Button
							disabled={!dirty || save.isPending}
							isLoading={save.isPending}
							onClick={() => void saveDraft()}
							type="button"
							variant="solid"
						>
							<Save aria-hidden />
							{t.units.content.saveDraft}
						</Button>
						{document.base.kind === "revision" ? (
							<Button asChild size="icon-md" variant="outline">
								<Link
									aria-label={t.units.workspace.sections.history.label}
									href={contentStructureHistoryHref("media", mediaId)}
								>
									<HistoryIcon aria-hidden />
								</Link>
							</Button>
						) : null}
					</>
				}
				description={t.units.workspace.sections.contentStructure.description}
				title={t.units.workspace.sections.contentStructure.label}
			/>
			<div className="grid gap-4">
				<div className="flex min-h-6 items-center gap-3">
					<p className="text-sm text-muted-foreground">{t.units.content.draftHint}</p>
					{dirty ? <Badge variant="warning">{t.units.content.unsavedDraft}</Badge> : null}
				</div>
				<MediaStructureTree
					nodes={document.draft}
					onChange={(change) =>
						setDocument((current) => ({
							...current,
							draft: change(current.draft),
						}))
					}
					onCreate={(request) => {
						save.reset();
						setCreateRequest(request);
					}}
					onOpenMediaItem={(nodeId) => void openMediaItem(nodeId)}
					pending={save.isPending}
				/>
				<RequestFailure error={save.error} />
			</div>
			{createRequest ? (
				<MediaContentNodeDialog
					error={save.error}
					nodes={document.draft}
					onClose={() => {
						save.reset();
						setCreateRequest(undefined);
					}}
					onSubmit={(submission) => void submitNode(submission)}
					pending={save.isPending}
					request={createRequest}
					unsavedChanges={dirty}
				/>
			) : null}
		</section>
	);
}

function resolveCreatePlacement(
	nodes: readonly MediaDraftNode[],
	destination: ContentStructureDestination,
): CreatePlacement | undefined {
	if (destination.kind === "root") return { parentId: null };
	const target = nodes.find(({ id }) => id === destination.nodeId);
	if (!target) return undefined;
	if (destination.placement === "inside")
		return isMediaDraftParentTarget(target) ? { parentId: target.id } : undefined;
	return { parentId: target.parentId, insertAfterId: target.id };
}

type MediaStructureTreeProps = {
	readonly nodes: readonly MediaDraftNode[];
	readonly onChange: (change: (nodes: readonly MediaDraftNode[]) => MediaDraftNode[]) => void;
	readonly onCreate: (request: MediaContentNodeDialogRequest) => void;
	readonly onOpenMediaItem: (nodeId: string) => void;
	readonly pending: boolean;
};

type MediaStructureRowProps = {
	readonly visibleEntry: VisibleBookStructureTreeNode<MediaDraftNode>;
	readonly siblingsByParentId: ReadonlyMap<string | null, readonly MediaDraftNode[]>;
	readonly pending: boolean;
	readonly expandedIds: ReadonlySet<string>;
	readonly draggingIds: ReadonlySet<string>;
	readonly dropTarget?: ActiveDropTarget;
	readonly validDropTargetIds: ReadonlySet<string>;
	readonly selectedIds: ReadonlySet<string>;
	readonly selectionMode: boolean;
	readonly onCreate: (request: MediaContentNodeDialogRequest) => void;
	readonly onActivate: (
		nodeId: string,
		modifiers: {
			readonly ctrlKey: boolean;
			readonly metaKey: boolean;
			readonly shiftKey: boolean;
		},
	) => void;
	readonly onContextTarget: (nodeId: string) => void;
	readonly onDragEnd: () => void;
	readonly onDragStart: (nodeId: string) => void;
	readonly onDrop: (target: MediaDraftDropTarget) => void;
	readonly onDropTargetChange: (target: MediaDraftDropTarget) => void;
	readonly onMoveRequest: (nodeId: string) => void;
	readonly onMoveToEdge: (nodeId: string, edge: "first" | "last") => void;
	readonly onOpenMediaItem: (nodeId: string) => void;
	readonly onRename: (node: MediaDraftNode) => void;
	readonly onToggle: (nodeId: string) => void;
};

function MediaStructureTree({
	nodes,
	onChange,
	onCreate,
	onOpenMediaItem,
	pending,
}: MediaStructureTreeProps) {
	const { t } = useTranslation(["units"]);
	const tree = useMemo(() => buildMediaDraftTree(nodes), [nodes]);
	const siblingsByParentId = useMemo(() => groupMediaSiblings(nodes), [nodes]);
	const allExpandableIds = useMemo(
		() => nodes.filter(isMediaDraftParentTarget).map(({ id }) => id),
		[nodes],
	);
	const expandableIdSet = useMemo(() => new Set(allExpandableIds), [allExpandableIds]);
	const [expandedIds, setExpandedIds] = useState<ReadonlySet<string>>(
		() => new Set(allExpandableIds),
	);
	const [renamingNode, setRenamingNode] = useState<MediaDraftNode>();
	const [draggingIds, setDraggingIds] = useState<ReadonlySet<string>>(EmptyIdSet);
	const [dropTarget, setDropTarget] = useState<ActiveDropTarget>();
	const [selectionMode, setSelectionMode] = useState(false);
	const [selectedRootIds, setSelectedRootIds] = useState<ReadonlySet<string>>(EmptyIdSet);
	const [selectionAnchorId, setSelectionAnchorId] = useState<string>();
	const [movingIds, setMovingIds] = useState<ReadonlySet<string>>();
	const visibleEntries = useMemo(
		() => flattenVisibleBookStructureTree(tree, expandedIds),
		[expandedIds, tree],
	);
	const visibleNodeIds = useMemo(
		() => visibleEntries.map(({ entry }) => entry.node.id),
		[visibleEntries],
	);
	const selectionCoverage = useMemo(
		() => indexMediaDraftSelectionCoverage(nodes, selectedRootIds),
		[nodes, selectedRootIds],
	);
	const selectedIds = useMemo(() => new Set(selectionCoverage.keys()), [selectionCoverage]);
	const validDropTargetIds = useMemo(
		() =>
			draggingIds.size ? getMediaDraftMoveTargetIds(nodes, draggingIds) : new Set<string>(),
		[draggingIds, nodes],
	);
	const counts = useMemo(
		() =>
			nodes.reduce(
				(result, node) => ({
					...result,
					[node.contentKind]: result[node.contentKind] + 1,
				}),
				{ video: 0, audio: 0, label: 0 },
			),
		[nodes],
	);

	function requestCreate(request: MediaContentNodeDialogRequest) {
		const { destination } = request;
		if (destination.kind === "node" && destination.placement === "inside")
			setExpandedIds((current) => new Set([...current, destination.nodeId]));
		onCreate(request);
	}

	function requestMainMediaItem(kind: "video" | "audio") {
		const lastLabelId = findLastMediaDraftLabelId(nodes);
		requestCreate({
			kind,
			destination: lastLabelId
				? { kind: "node", nodeId: lastLabelId, placement: "inside" }
				: { kind: "root" },
		});
	}

	function finishDrag() {
		setDraggingIds(EmptyIdSet);
		setDropTarget(undefined);
	}

	function changeDropTarget(next: MediaDraftDropTarget) {
		setDropTarget((current) => {
			if (current?.kind !== next.kind) return next;
			if (current.kind === "root" && next.kind === "root") return current;
			if (
				current.kind === "node" &&
				next.kind === "node" &&
				current.nodeId === next.nodeId &&
				current.placement === next.placement
			)
				return current;
			return next;
		});
	}

	function drop(target: MediaDraftDropTarget) {
		if (!draggingIds.size) return;
		onChange((current) => moveMediaDraftSelection(current, draggingIds, target));
		if (target.kind === "node" && target.placement === "inside")
			setExpandedIds((current) => new Set([...current, target.nodeId]));
		finishDrag();
	}

	function actionIds(nodeId: string): ReadonlySet<string> {
		return selectionMode && selectionCoverage.has(nodeId) ? selectedRootIds : new Set([nodeId]);
	}

	function moveToEdge(nodeId: string, edge: "first" | "last") {
		const ids = actionIds(nodeId);
		onChange((current) => moveMediaDraftSelectionToSiblingEdge(current, ids, edge));
	}

	function requestMove(nodeId: string) {
		setMovingIds(new Set(actionIds(nodeId)));
	}

	function startDrag(nodeId: string) {
		setDraggingIds(new Set([...actionIds(nodeId), nodeId]));
	}

	function toggle(nodeId: string) {
		setExpandedIds((current) => {
			const next = new Set(current);
			if (next.has(nodeId)) next.delete(nodeId);
			else next.add(nodeId);
			return next;
		});
	}

	function setMultiSelectMode(enabled: boolean) {
		setSelectionMode(enabled);
		if (enabled) return;
		setSelectedRootIds(EmptyIdSet);
		setSelectionAnchorId(undefined);
	}

	function activate(
		nodeId: string,
		modifiers: {
			readonly ctrlKey: boolean;
			readonly metaKey: boolean;
			readonly shiftKey: boolean;
		},
	) {
		const modified = modifiers.ctrlKey || modifiers.metaKey || modifiers.shiftKey;
		if (!selectionMode && !modified) {
			setSelectionAnchorId(nodeId);
			if (expandableIdSet.has(nodeId)) toggle(nodeId);
			else onOpenMediaItem(nodeId);
			return;
		}
		setSelectionMode(true);
		if (modifiers.shiftKey && selectionAnchorId) {
			const anchorIndex = visibleNodeIds.indexOf(selectionAnchorId);
			const nodeIndex = visibleNodeIds.indexOf(nodeId);
			if (anchorIndex >= 0 && nodeIndex >= 0) {
				const start = Math.min(anchorIndex, nodeIndex);
				const end = Math.max(anchorIndex, nodeIndex);
				const range = visibleNodeIds.slice(start, end + 1);
				setSelectedRootIds((current) =>
					normalizeMediaDraftSelectionIds(
						nodes,
						modifiers.ctrlKey || modifiers.metaKey
							? new Set([...current, ...range])
							: new Set(range),
					),
				);
				return;
			}
		}
		setSelectedRootIds((current) => {
			const next = new Set(current);
			const coveringRootId = indexMediaDraftSelectionCoverage(nodes, current).get(nodeId);
			if (coveringRootId) next.delete(coveringRootId);
			else next.add(nodeId);
			return normalizeMediaDraftSelectionIds(nodes, next);
		});
		setSelectionAnchorId(nodeId);
	}

	function contextTarget(nodeId: string) {
		if (!selectionMode || selectionCoverage.has(nodeId)) return;
		setSelectedRootIds(new Set([nodeId]));
		setSelectionAnchorId(nodeId);
	}

	return (
		<>
			<section>
				<header className="flex flex-wrap items-end justify-between gap-4 border-b border-border-weak pb-4">
					<div className="min-w-0">
						<h2 className="font-heading text-lg font-semibold">
							{t.units.content.title}
						</h2>
						<p className="mt-1 text-sm text-muted-foreground">
							{t.units.content.mediaStructureSummary({
								videos: counts.video,
								audios: counts.audio,
								labels: counts.label,
							})}
						</p>
					</div>
					<div className="flex flex-wrap items-center justify-end gap-2">
						<Button
							aria-pressed={selectionMode}
							onClick={() => setMultiSelectMode(!selectionMode)}
							type="button"
							variant={selectionMode ? "outline" : "quiet"}
						>
							{selectionMode ? (
								<SquareCheckBig aria-hidden />
							) : (
								<Square aria-hidden />
							)}
							{selectionMode
								? t.units.content.selectedCount({ count: selectedRootIds.size })
								: t.units.content.multiSelect}
						</Button>
						<Button
							onClick={() => setExpandedIds(new Set(allExpandableIds))}
							type="button"
							variant="quiet"
						>
							<ChevronsUpDown aria-hidden />
							{t.units.content.expandAll}
						</Button>
						<Button
							onClick={() => setExpandedIds(new Set())}
							type="button"
							variant="quiet"
						>
							<ChevronsDownUp aria-hidden />
							{t.units.content.collapseAll}
						</Button>
						<span aria-hidden className="mx-1 h-7 w-px bg-border-weak" />
						<Button
							disabled={pending}
							onClick={() =>
								requestCreate({
									kind: "label",
									destination: { kind: "root" },
								})
							}
							type="button"
							variant="outline"
						>
							<ListTree aria-hidden />
							{t.units.content.newLabel}
						</Button>
						<Menu>
							<MenuTrigger asChild>
								<Button disabled={pending} type="button" variant="solid">
									<Plus aria-hidden />
									{t.units.content.newMediaItem}
								</Button>
							</MenuTrigger>
							<MenuContent>
								<MenuItem
									onSelect={() => requestMainMediaItem("video")}
									value="new-video"
								>
									<Video aria-hidden />
									{t.units.content.newVideo}
								</MenuItem>
								<MenuItem
									onSelect={() => requestMainMediaItem("audio")}
									value="new-audio"
								>
									<AudioLines aria-hidden />
									{t.units.content.newAudio}
								</MenuItem>
							</MenuContent>
						</Menu>
					</div>
				</header>
				<div className="min-h-[36rem]">
					{draggingIds.size ? (
						<div
							className={cn(
								"relative flex min-h-24 items-center gap-3 border-b border-border-weak px-4 transition-colors",
								"bg-muted/20",
								dropTarget?.kind === "root" &&
									"bg-primary/8 outline-2 outline-primary -outline-offset-2",
							)}
							onDragOverCapture={(event) => {
								event.preventDefault();
								event.dataTransfer.dropEffect = "move";
								changeDropTarget({ kind: "root" });
							}}
							onDrop={(event) => {
								event.preventDefault();
								drop({ kind: "root" });
							}}
						>
							<div className="grid size-10 shrink-0 place-items-center rounded-xl bg-foreground text-background">
								<Film aria-hidden className="size-5" />
							</div>
							<p className="min-w-0 flex-1 truncate font-heading text-base font-semibold">
								{t.units.content.root}
							</p>
						</div>
					) : null}
					{tree.length ? (
						<VirtualizedBookContentStructureRows
							ariaMultiselectable={selectionMode}
							entries={visibleEntries}
							label={t.units.content.title}
							onDragOverCapture={(event) => {
								if (!draggingIds.size) return;
								const distanceFromTop = event.clientY;
								const distanceFromBottom = window.innerHeight - event.clientY;
								if (distanceFromTop < 96) window.scrollBy({ top: -24 });
								else if (distanceFromBottom < 96) window.scrollBy({ top: 24 });
							}}
							pinnedNodeIds={draggingIds}
							renderRow={(visibleEntry) => (
								<MediaContentStructureRow
									draggingIds={draggingIds}
									dropTarget={dropTarget}
									expandedIds={expandedIds}
									onActivate={activate}
									onContextTarget={contextTarget}
									onCreate={requestCreate}
									onDragEnd={finishDrag}
									onDragStart={startDrag}
									onDrop={drop}
									onDropTargetChange={changeDropTarget}
									onMoveRequest={requestMove}
									onMoveToEdge={moveToEdge}
									onOpenMediaItem={onOpenMediaItem}
									onRename={setRenamingNode}
									onToggle={toggle}
									pending={pending}
									selectedIds={selectedIds}
									selectionMode={selectionMode}
									siblingsByParentId={siblingsByParentId}
									validDropTargetIds={validDropTargetIds}
									visibleEntry={visibleEntry}
								/>
							)}
						/>
					) : (
						<div className="grid min-h-[36rem] place-items-center px-6 text-center">
							<div>
								<ListTree
									aria-hidden
									className="mx-auto size-8 text-muted-foreground"
								/>
								<p className="mt-3 text-sm text-muted-foreground">
									{t.units.content.noMediaContent}
								</p>
							</div>
						</div>
					)}
				</div>
			</section>
			{renamingNode ? (
				<RenameMediaNodeDialog
					node={renamingNode}
					onClose={() => setRenamingNode(undefined)}
					onRename={(title) => {
						onChange((current) =>
							renameMediaDraftNode(current, renamingNode.id, title),
						);
						setRenamingNode(undefined);
					}}
				/>
			) : null}
			{movingIds ? (
				<ContentStructureDestinationDialog
					description={t.units.content.mediaMoveDescription}
					nodes={nodes}
					onClose={() => setMovingIds(undefined)}
					onSelect={(destination) => {
						onChange((current) =>
							moveMediaDraftSelection(current, movingIds, destination),
						);
						if (destination.kind === "node" && destination.placement === "inside")
							setExpandedIds((current) => new Set([...current, destination.nodeId]));
						setMovingIds(undefined);
					}}
					title={t.units.content.move}
					validTargetIds={getMediaDraftMoveTargetIds(nodes, movingIds)}
				/>
			) : null}
		</>
	);
}

function groupMediaSiblings(
	nodes: readonly MediaDraftNode[],
): ReadonlyMap<string | null, readonly MediaDraftNode[]> {
	const groups = new Map<string | null, MediaDraftNode[]>();
	for (const node of nodes) {
		const siblings = groups.get(node.parentId);
		if (siblings) siblings.push(node);
		else groups.set(node.parentId, [node]);
	}
	for (const siblings of groups.values())
		siblings.sort((left, right) => left.order - right.order || left.id.localeCompare(right.id));
	return groups;
}

function MediaContentStructureRow(props: MediaStructureRowProps) {
	const {
		visibleEntry,
		siblingsByParentId,
		pending,
		expandedIds,
		draggingIds,
		dropTarget,
		validDropTargetIds,
		selectedIds,
		selectionMode,
		onActivate,
		onContextTarget,
		onCreate,
		onDragEnd,
		onDragStart,
		onDrop,
		onDropTargetChange,
		onMoveRequest,
		onMoveToEdge,
		onRename,
		onToggle,
	} = props;
	const { t } = useTranslation(["units"]);
	const { entry, depth, positionInSet, setSize } = visibleEntry;
	const { node, children } = entry;
	const label = isMediaDraftParentTarget(node);
	const expanded = expandedIds.has(node.id);
	const canDrop = validDropTargetIds.has(node.id);
	const selected = selectedIds.has(node.id);
	const siblings = siblingsByParentId.get(node.parentId) ?? [];
	const siblingIndex = siblings.findIndex(({ id }) => id === node.id);
	const activePlacement =
		dropTarget?.kind === "node" && dropTarget.nodeId === node.id
			? dropTarget.placement
			: undefined;

	function placement(event: DragEvent<HTMLDivElement>): "before" | "inside" | "after" {
		const bounds = event.currentTarget.getBoundingClientRect();
		const ratio = bounds.height ? (event.clientY - bounds.top) / bounds.height : 0.5;
		if (!label) return ratio < 0.5 ? "before" : "after";
		return ratio < 0.25 ? "before" : ratio > 0.75 ? "after" : "inside";
	}

	const Icon =
		node.contentKind === "video" ? Video : node.contentKind === "audio" ? AudioLines : ListTree;
	const kindLabel =
		node.contentKind === "video"
			? t.units.types.video
			: node.contentKind === "audio"
				? t.units.types.audio
				: t.units.content.label;
	const row = (
		<BookContentStructureRowFrame
			activePlacement={activePlacement}
			aria-checked={selectionMode ? selected : undefined}
			aria-expanded={label ? expanded : undefined}
			aria-level={depth + 1}
			aria-posinset={positionInSet}
			aria-setsize={setSize}
			depth={depth}
			dragging={draggingIds.has(node.id)}
			onContextMenu={() => onContextTarget(node.id)}
			onDragOver={(event) => {
				if (!canDrop) return;
				event.preventDefault();
				event.stopPropagation();
				event.dataTransfer.dropEffect = "move";
				onDropTargetChange({
					kind: "node",
					nodeId: node.id,
					placement: placement(event),
				});
			}}
			onDrop={(event) => {
				if (!canDrop) return;
				event.preventDefault();
				event.stopPropagation();
				onDrop({
					kind: "node",
					nodeId: node.id,
					placement: placement(event),
				});
			}}
			role="treeitem"
			selected={selected}
		>
			<button
				className="flex min-w-0 flex-1 items-center gap-3 self-stretch text-start outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
				disabled={pending}
				onClick={(event: MouseEvent<HTMLButtonElement>) =>
					onActivate(node.id, {
						ctrlKey: event.ctrlKey,
						metaKey: event.metaKey,
						shiftKey: event.shiftKey,
					})
				}
				type="button"
			>
				{selectionMode ? (
					selected ? (
						<SquareCheckBig aria-hidden className="size-5 shrink-0 text-primary" />
					) : (
						<Square aria-hidden className="size-5 shrink-0 text-muted-foreground" />
					)
				) : null}
				<Icon aria-hidden className="size-5 shrink-0 text-muted-foreground" />
				<span className="min-w-0 flex-1">
					<span className="flex min-w-0 items-center gap-2">
						{label ? (
							<ChevronRight
								aria-hidden
								className={cn(
									"size-4 shrink-0 text-muted-foreground transition-transform motion-reduce:transition-none",
									expanded && "rotate-90",
								)}
							/>
						) : null}
						<span className="truncate font-heading text-base font-semibold text-foreground">
							{node.title}
						</span>
					</span>
					<span className="mt-2 flex items-center gap-4 text-sm text-muted-foreground">
						<span>{kindLabel}</span>
						{label ? (
							<span>{t.units.content.childCount({ count: children.length })}</span>
						) : (
							<span>
								{formatDuration(node.durationSeconds) ??
									t.units.content.durationUnknown}
							</span>
						)}
					</span>
				</span>
			</button>
			<button
				aria-label={t.units.content.dragHandle}
				className="grid size-9 shrink-0 cursor-grab place-items-center rounded-lg text-muted-foreground opacity-80 outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing sm:opacity-0 sm:group-hover/structure-row:opacity-100 sm:group-focus-within/structure-row:opacity-100"
				disabled={pending}
				draggable={!pending}
				onClick={(event) => event.stopPropagation()}
				onDragEnd={onDragEnd}
				onDragStart={(event) => {
					event.stopPropagation();
					event.dataTransfer.effectAllowed = "move";
					event.dataTransfer.setData("text/plain", node.id);
					onDragStart(node.id);
				}}
				type="button"
			>
				<GripVertical aria-hidden className="size-4" />
			</button>
			{selectionMode ? (
				<MediaSelectionActionMenu
					canMoveToFirst={selected ? true : siblingIndex > 0}
					canMoveToLast={
						selected ? true : siblingIndex >= 0 && siblingIndex < siblings.length - 1
					}
					nodeId={node.id}
					onMoveRequest={onMoveRequest}
					onMoveToEdge={onMoveToEdge}
					onTarget={onContextTarget}
					pending={pending}
				/>
			) : (
				<MediaNodeActionMenu
					canMoveToFirst={siblingIndex > 0}
					canMoveToLast={siblingIndex >= 0 && siblingIndex < siblings.length - 1}
					expanded={expanded}
					node={node}
					onCreate={onCreate}
					onMoveRequest={onMoveRequest}
					onMoveToEdge={onMoveToEdge}
					onRename={onRename}
					onToggle={onToggle}
					pending={pending}
				/>
			)}
		</BookContentStructureRowFrame>
	);
	return (
		<ContextMenu>
			<ContextMenuTrigger asChild>{row}</ContextMenuTrigger>
			<ContextMenuContent>
				{selectionMode ? (
					<MediaSelectionContextMenuItems
						canMoveToFirst={selected ? true : siblingIndex > 0}
						canMoveToLast={
							selected
								? true
								: siblingIndex >= 0 && siblingIndex < siblings.length - 1
						}
						nodeId={node.id}
						onMoveRequest={onMoveRequest}
						onMoveToEdge={onMoveToEdge}
						pending={pending}
					/>
				) : (
					<MediaNodeContextMenuItems
						canMoveToFirst={siblingIndex > 0}
						canMoveToLast={siblingIndex >= 0 && siblingIndex < siblings.length - 1}
						expanded={expanded}
						node={node}
						onCreate={onCreate}
						onMoveRequest={onMoveRequest}
						onMoveToEdge={onMoveToEdge}
						onRename={onRename}
						onToggle={onToggle}
						pending={pending}
					/>
				)}
			</ContextMenuContent>
		</ContextMenu>
	);
}

type SelectionMoveMenuProps = {
	readonly nodeId: string;
	readonly canMoveToFirst: boolean;
	readonly canMoveToLast: boolean;
	readonly pending: boolean;
	readonly onMoveRequest: (nodeId: string) => void;
	readonly onMoveToEdge: (nodeId: string, edge: "first" | "last") => void;
};

function MediaSelectionActionMenu({
	nodeId,
	canMoveToFirst,
	canMoveToLast,
	pending,
	onMoveRequest,
	onMoveToEdge,
	onTarget,
}: SelectionMoveMenuProps & {
	readonly onTarget: (nodeId: string) => void;
}) {
	const { t } = useTranslation(["units"]);
	return (
		<Menu>
			<MenuTrigger asChild>
				<Button
					aria-label={t.units.content.selectionActions}
					disabled={pending}
					onClick={(event) => {
						event.stopPropagation();
						onTarget(nodeId);
					}}
					size="icon-sm"
					type="button"
					variant="quiet"
				>
					<Ellipsis aria-hidden />
				</Button>
			</MenuTrigger>
			<MenuContent>
				<MenuItem
					disabled={!canMoveToFirst}
					onSelect={() => onMoveToEdge(nodeId, "first")}
					value="selection-move-to-first"
				>
					<ArrowUpToLine aria-hidden />
					{t.units.content.moveToFirst}
				</MenuItem>
				<MenuItem
					disabled={!canMoveToLast}
					onSelect={() => onMoveToEdge(nodeId, "last")}
					value="selection-move-to-last"
				>
					<ArrowDownToLine aria-hidden />
					{t.units.content.moveToLast}
				</MenuItem>
				<MenuItem onSelect={() => onMoveRequest(nodeId)} value="selection-move">
					<Move aria-hidden />
					{t.units.content.move}
				</MenuItem>
			</MenuContent>
		</Menu>
	);
}

function MediaSelectionContextMenuItems({
	nodeId,
	canMoveToFirst,
	canMoveToLast,
	pending,
	onMoveRequest,
	onMoveToEdge,
}: SelectionMoveMenuProps) {
	const { t } = useTranslation(["units"]);
	return (
		<>
			<ContextMenuItem
				disabled={pending || !canMoveToFirst}
				onSelect={() => onMoveToEdge(nodeId, "first")}
				value="context-selection-move-to-first"
			>
				<ArrowUpToLine aria-hidden />
				{t.units.content.moveToFirst}
			</ContextMenuItem>
			<ContextMenuItem
				disabled={pending || !canMoveToLast}
				onSelect={() => onMoveToEdge(nodeId, "last")}
				value="context-selection-move-to-last"
			>
				<ArrowDownToLine aria-hidden />
				{t.units.content.moveToLast}
			</ContextMenuItem>
			<ContextMenuItem
				disabled={pending}
				onSelect={() => onMoveRequest(nodeId)}
				value="context-selection-move"
			>
				<Move aria-hidden />
				{t.units.content.move}
			</ContextMenuItem>
		</>
	);
}

type MediaNodeMenuProps = {
	readonly node: MediaDraftNode;
	readonly expanded: boolean;
	readonly canMoveToFirst: boolean;
	readonly canMoveToLast: boolean;
	readonly pending: boolean;
	readonly onCreate: (request: MediaContentNodeDialogRequest) => void;
	readonly onMoveRequest: (nodeId: string) => void;
	readonly onMoveToEdge: (nodeId: string, edge: "first" | "last") => void;
	readonly onRename: (node: MediaDraftNode) => void;
	readonly onToggle: (nodeId: string) => void;
};

function MediaNodeActionMenu(props: MediaNodeMenuProps) {
	const { t } = useTranslation(["units"]);
	const {
		node,
		expanded,
		canMoveToFirst,
		canMoveToLast,
		pending,
		onCreate,
		onMoveRequest,
		onMoveToEdge,
		onRename,
		onToggle,
	} = props;
	const destination = contentStructureDestinationForNode(node);
	const label = isMediaDraftParentTarget(node);
	return (
		<Menu>
			<MenuTrigger asChild>
				<Button
					aria-label={t.units.content.actions}
					disabled={pending}
					onClick={(event) => event.stopPropagation()}
					size="icon-sm"
					type="button"
					variant="quiet"
				>
					<Ellipsis aria-hidden />
				</Button>
			</MenuTrigger>
			<MenuContent>
				<MenuItem
					onSelect={() => onCreate({ kind: "video", destination })}
					value="new-video"
				>
					<Video aria-hidden />
					{label ? t.units.content.newVideo : t.units.content.newVideoAfter}
				</MenuItem>
				<MenuItem
					onSelect={() => onCreate({ kind: "audio", destination })}
					value="new-audio"
				>
					<AudioLines aria-hidden />
					{label ? t.units.content.newAudio : t.units.content.newAudioAfter}
				</MenuItem>
				<MenuItem
					onSelect={() => onCreate({ kind: "label", destination })}
					value="new-label"
				>
					<ListTree aria-hidden />
					{label ? t.units.content.newLabel : t.units.content.newLabelAfter}
				</MenuItem>
				{label ? (
					<MenuItem onSelect={() => onToggle(node.id)} value="toggle">
						<ChevronRight
							aria-hidden
							className={cn("transition-transform", expanded && "rotate-90")}
						/>
						{expanded ? t.units.content.collapse : t.units.content.expand}
					</MenuItem>
				) : null}
				<MenuItem
					disabled={!canMoveToFirst}
					onSelect={() => onMoveToEdge(node.id, "first")}
					value="move-to-first"
				>
					<ArrowUpToLine aria-hidden />
					{t.units.content.moveToFirst}
				</MenuItem>
				<MenuItem
					disabled={!canMoveToLast}
					onSelect={() => onMoveToEdge(node.id, "last")}
					value="move-to-last"
				>
					<ArrowDownToLine aria-hidden />
					{t.units.content.moveToLast}
				</MenuItem>
				<MenuItem onSelect={() => onMoveRequest(node.id)} value="move">
					<Move aria-hidden />
					{t.units.content.move}
				</MenuItem>
				<MenuItem onSelect={() => onRename(node)} value="rename">
					<Pencil aria-hidden />
					{t.units.content.rename}
				</MenuItem>
			</MenuContent>
		</Menu>
	);
}

function MediaNodeContextMenuItems(props: MediaNodeMenuProps) {
	const { t } = useTranslation(["units"]);
	const {
		node,
		expanded,
		canMoveToFirst,
		canMoveToLast,
		pending,
		onCreate,
		onMoveRequest,
		onMoveToEdge,
		onRename,
		onToggle,
	} = props;
	const destination = contentStructureDestinationForNode(node);
	const label = isMediaDraftParentTarget(node);
	return (
		<>
			<ContextMenuItem
				disabled={pending}
				onSelect={() => onCreate({ kind: "video", destination })}
				value="context-new-video"
			>
				<Video aria-hidden />
				{label ? t.units.content.newVideo : t.units.content.newVideoAfter}
			</ContextMenuItem>
			<ContextMenuItem
				disabled={pending}
				onSelect={() => onCreate({ kind: "audio", destination })}
				value="context-new-audio"
			>
				<AudioLines aria-hidden />
				{label ? t.units.content.newAudio : t.units.content.newAudioAfter}
			</ContextMenuItem>
			<ContextMenuItem
				disabled={pending}
				onSelect={() => onCreate({ kind: "label", destination })}
				value="context-new-label"
			>
				<ListTree aria-hidden />
				{label ? t.units.content.newLabel : t.units.content.newLabelAfter}
			</ContextMenuItem>
			{label ? (
				<ContextMenuItem
					disabled={pending}
					onSelect={() => onToggle(node.id)}
					value="context-toggle"
				>
					<ChevronRight
						aria-hidden
						className={cn("transition-transform", expanded && "rotate-90")}
					/>
					{expanded ? t.units.content.collapse : t.units.content.expand}
				</ContextMenuItem>
			) : null}
			<ContextMenuItem
				disabled={pending || !canMoveToFirst}
				onSelect={() => onMoveToEdge(node.id, "first")}
				value="context-move-to-first"
			>
				<ArrowUpToLine aria-hidden />
				{t.units.content.moveToFirst}
			</ContextMenuItem>
			<ContextMenuItem
				disabled={pending || !canMoveToLast}
				onSelect={() => onMoveToEdge(node.id, "last")}
				value="context-move-to-last"
			>
				<ArrowDownToLine aria-hidden />
				{t.units.content.moveToLast}
			</ContextMenuItem>
			<ContextMenuItem
				disabled={pending}
				onSelect={() => onMoveRequest(node.id)}
				value="context-move"
			>
				<Move aria-hidden />
				{t.units.content.move}
			</ContextMenuItem>
			<ContextMenuItem
				disabled={pending}
				onSelect={() => onRename(node)}
				value="context-rename"
			>
				<Pencil aria-hidden />
				{t.units.content.rename}
			</ContextMenuItem>
		</>
	);
}

function RenameMediaNodeDialog({
	node,
	onClose,
	onRename,
}: {
	readonly node: MediaDraftNode;
	readonly onClose: () => void;
	readonly onRename: (title: string) => void;
}) {
	const { t } = useTranslation(["engagement", "units", "ui"]);
	return (
		<Dialog
			onOpenChange={({ open }) => {
				if (!open) onClose();
			}}
			open
		>
			<DialogContent size="sm">
				<DialogHeader title={t.units.content.rename} />
				<form
					onSubmit={(event) => {
						event.preventDefault();
						const title = String(
							new FormData(event.currentTarget).get("title") ?? "",
						).trim();
						if (title) onRename(title);
					}}
				>
					<DialogBody>
						<Field required>
							<FieldLabel>{t.ui.title}</FieldLabel>
							<Input
								autoFocus
								defaultValue={node.title}
								maxLength={500}
								name="title"
								required
							/>
						</Field>
					</DialogBody>
					<DialogFooter>
						<DialogClose asChild>
							<Button type="button" variant="quiet">
								{t.engagement.cancel}
							</Button>
						</DialogClose>
						<Button type="submit" variant="solid">
							{t.ui.save}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
