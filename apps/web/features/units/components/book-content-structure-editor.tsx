"use client";

import { toContentLanguage } from "@rezics/i18n";
import {
	type GetApiUnitsBookByUnitIdContentStructureNodesStatus200,
	usePutApiUnitsBookByUnitIdContentStructure,
} from "@rezics/openapi-tanstack-query";
import { useQueryClient } from "@tanstack/react-query";
import {
	ArrowDownToLine,
	ArrowUpToLine,
	BookOpenText,
	ChevronRight,
	ChevronsDownUp,
	ChevronsUpDown,
	Ellipsis,
	Eye,
	FileText,
	Folder,
	GripVertical,
	HistoryIcon,
	ListTree,
	Move,
	Pencil,
	Plus,
	Save,
	Square,
	SquareCheckBig,
	Text,
	Undo2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type CSSProperties, type DragEvent, type MouseEvent, useMemo, useState } from "react";

import {
	Badge,
	Button,
	Card,
	CardContent,
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
import { writePortableText } from "@/lib/block";
import { invalidateBookContentStructure } from "../unit-cache";
import {
	addBookDraftNode,
	addBookDraftNodeAfter,
	bookContentStructureDraftFingerprint,
	buildBookDraftTree,
	createBookContentStructureDraft,
	findLastBookDraftLabelId,
	getBookDraftMoveTargetIds,
	isBookDraftParentTarget,
	moveBookDraftSelection,
	moveBookDraftSelectionToSiblingEdge,
	renameBookDraftNode,
	toBookContentStructureSaveNodes,
	type BookDraftDropTarget,
	type BookDraftNode,
	type BookDraftTreeNode,
	type NewBookDraftNodeInput,
} from "../model/book-content-structure-draft";
import {
	bookContentStructureHistoryHref,
	chapterEditorHref,
} from "../routing/unit-management-routes";
import {
	bookStructureDestinationForNode,
	BookContentStructureDestinationDialog,
	type BookStructureDestination,
} from "./book-content-structure-destination-dialog";
import { UnitSectionHeader } from "./unit-section-header";

type BookStructureResponse = GetApiUnitsBookByUnitIdContentStructureNodesStatus200;

type EditorDocument = {
	readonly baseRevisionId: string;
	readonly baseline: readonly BookDraftNode[];
	readonly draft: readonly BookDraftNode[];
	readonly ownContentMetricsByNodeId: ReadonlyMap<string, ContentMetrics>;
};

type CreateRequest = {
	readonly kind: "chapter" | "label";
	readonly destination: BookStructureDestination;
};

type ActiveDropTarget = BookDraftDropTarget | undefined;

const EmptyIdSet: ReadonlySet<string> = new Set();

type ContentMetrics = {
	readonly wordCount: number;
	readonly characterCount: number;
};

const EmptyContentMetrics: ContentMetrics = {
	wordCount: 0,
	characterCount: 0,
};

type StructureTreeProps = {
	nodes: readonly BookDraftNode[];
	ownContentMetricsByNodeId: ReadonlyMap<string, ContentMetrics>;
	pending: boolean;
	onChange: (change: (nodes: readonly BookDraftNode[]) => BookDraftNode[]) => void;
	onCreate: (request: CreateRequest) => void;
	onOpenChapter: (nodeId: string) => void;
};

type StructureRowProps = {
	entry: BookDraftTreeNode;
	depth: number;
	siblingsByParentId: ReadonlyMap<string | null, readonly BookDraftNode[]>;
	pending: boolean;
	expandedIds: ReadonlySet<string>;
	draggingIds: ReadonlySet<string>;
	dropTarget?: ActiveDropTarget;
	validDropTargetIds: ReadonlySet<string>;
	contentMetricsByNodeId: ReadonlyMap<string, ContentMetrics>;
	selectedIds: ReadonlySet<string>;
	selectionMode: boolean;
	onCreate: (request: CreateRequest) => void;
	onActivate: (
		nodeId: string,
		modifiers: {
			readonly ctrlKey: boolean;
			readonly metaKey: boolean;
			readonly shiftKey: boolean;
		},
	) => void;
	onContextTarget: (nodeId: string) => void;
	onDragEnd: () => void;
	onDragStart: (nodeId: string) => void;
	onDrop: (target: BookDraftDropTarget) => void;
	onDropTargetChange: (target: BookDraftDropTarget) => void;
	onMoveRequest: (nodeId: string) => void;
	onMoveToEdge: (nodeId: string, edge: "first" | "last") => void;
	onRename: (node: BookDraftNode) => void;
	onToggle: (nodeId: string) => void;
};

export function BookContentStructureEditor({
	bookId,
	initial,
}: {
	bookId: string;
	initial: BookStructureResponse & { structureId: string; latestRevisionId: string };
}) {
	const { t, locale } = useTranslation(["engagement", "units"]);
	const router = useRouter();
	const queryClient = useQueryClient();
	const initialDraft = useMemo(() => createBookContentStructureDraft(initial.items), [initial]);
	const initialContentMetrics = useMemo(() => indexOwnContentMetrics(initial.items), [initial]);
	const [document, setDocument] = useState<EditorDocument>({
		baseRevisionId: initial.latestRevisionId,
		baseline: initialDraft,
		draft: initialDraft,
		ownContentMetricsByNodeId: initialContentMetrics,
	});
	const [createRequest, setCreateRequest] = useState<CreateRequest>();
	const save = usePutApiUnitsBookByUnitIdContentStructure();
	const dirty =
		bookContentStructureDraftFingerprint(document.draft) !==
		bookContentStructureDraftFingerprint(document.baseline);

	async function saveDraft() {
		if (!dirty || save.isPending) return undefined;
		try {
			const saved = await save.mutateAsync({
				path: { unitId: bookId },
				body: {
					baseRevisionId: document.baseRevisionId,
					nodes: toBookContentStructureSaveNodes(document.draft),
				},
			});
			const savedDraft = createBookContentStructureDraft(saved.items);
			setDocument({
				baseRevisionId: saved.latestRevisionId,
				baseline: savedDraft,
				draft: savedDraft,
				ownContentMetricsByNodeId: indexOwnContentMetrics(saved.items),
			});
			void invalidateBookContentStructure(queryClient, bookId);
			return saved;
		} catch {
			// The typed mutation renders the visible request failure.
			return undefined;
		}
	}

	async function openChapter(nodeId: string) {
		const node = document.draft.find(({ id }) => id === nodeId);
		if (!node || save.isPending) return;
		let chapterId = node.state === "existing" ? node.contentUnitId : undefined;
		if (dirty) {
			const saved = await saveDraft();
			chapterId = saved?.items.find(({ id }) => id === nodeId)?.contentUnitId;
		}
		if (chapterId) router.push(chapterEditorHref(bookId, chapterId));
	}

	function createNode(title: string, destination: BookStructureDestination) {
		if (!createRequest) return;
		const placement = resolveCreatePlacement(document.draft, destination);
		if (!placement) return;
		const common = {
			state: "new" as const,
			id: crypto.randomUUID(),
			parentId: placement.parentId,
			title,
			language: toContentLanguage(locale.target),
		};
		const node: NewBookDraftNodeInput =
			createRequest.kind === "chapter"
				? {
						...common,
						contentKind: "chapter",
						content: writePortableText([]),
						status: "draft",
					}
				: { ...common, contentKind: "chapter_group" };
		setDocument((current) => ({
			...current,
			draft: placement.insertAfterId
				? addBookDraftNodeAfter(current.draft, node, placement.insertAfterId)
				: addBookDraftNode(current.draft, node),
		}));
		setCreateRequest(undefined);
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
								setDocument((current) => ({
									...current,
									draft: current.baseline,
								}))
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
						<Button asChild size="icon-md" variant="outline">
							<Link
								aria-label={t.units.workspace.sections.history.label}
								href={bookContentStructureHistoryHref(bookId)}
							>
								<HistoryIcon aria-hidden />
							</Link>
						</Button>
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
				<BookContentStructureTree
					nodes={document.draft}
					onChange={(change) =>
						setDocument((current) => ({
							...current,
							draft: change(current.draft),
						}))
					}
					onCreate={setCreateRequest}
					onOpenChapter={(nodeId) => void openChapter(nodeId)}
					ownContentMetricsByNodeId={document.ownContentMetricsByNodeId}
					pending={save.isPending}
				/>
				<RequestFailure error={save.error} />
			</div>
			{createRequest ? (
				<CreateStructureNodeDialog
					kind={createRequest.kind}
					nodes={document.draft}
					onClose={() => setCreateRequest(undefined)}
					onCreate={createNode}
					requestedDestination={createRequest.destination}
				/>
			) : null}
		</section>
	);
}

function CreateStructureNodeDialog({
	kind,
	nodes,
	onClose,
	onCreate,
	requestedDestination,
}: {
	kind: CreateRequest["kind"];
	nodes: readonly BookDraftNode[];
	onClose: () => void;
	onCreate: (title: string, destination: BookStructureDestination) => void;
	requestedDestination: BookStructureDestination;
}) {
	const { t } = useTranslation(["engagement", "units", "ui"]);
	const [destination, setDestination] = useState<BookStructureDestination>(requestedDestination);
	const [destinationDialogOpen, setDestinationDialogOpen] = useState(false);
	const destinationLabel = structureDestinationLabel(nodes, destination, t.units.content.root);

	return (
		<>
			<Dialog
				onOpenChange={({ open }) => {
					if (!open) onClose();
				}}
				open
			>
				<DialogContent size="lg">
					<DialogHeader
						description={
							kind === "chapter"
								? t.units.content.createChapterDescription
								: t.units.content.createLabelDescription
						}
						title={
							kind === "chapter"
								? t.units.content.createChapter
								: t.units.content.createLabel
						}
					/>
					<form
						onSubmit={(event) => {
							event.preventDefault();
							const title = String(
								new FormData(event.currentTarget).get("title") ?? "",
							).trim();
							if (title) onCreate(title, destination);
						}}
					>
						<DialogBody className="grid gap-5">
							<Field>
								<FieldLabel>{t.units.content.structure}</FieldLabel>
								<button
									aria-haspopup="dialog"
									className="flex min-h-11 w-full items-center gap-3 rounded-xl border border-border-weak bg-muted/35 px-3.5 text-start text-sm outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
									onClick={() => setDestinationDialogOpen(true)}
									type="button"
								>
									<Folder
										aria-hidden
										className="size-4 shrink-0 text-muted-foreground"
									/>
									<span className="min-w-0 flex-1 truncate font-medium">
										{destinationLabel}
									</span>
									<ChevronRight
										aria-hidden
										className="size-4 shrink-0 text-muted-foreground"
									/>
								</button>
							</Field>
							<Field required>
								<FieldLabel>{t.ui.title}</FieldLabel>
								<Input autoFocus maxLength={500} name="title" required />
							</Field>
						</DialogBody>
						<DialogFooter>
							<DialogClose asChild>
								<Button type="button" variant="quiet">
									{t.engagement.cancel}
								</Button>
							</DialogClose>
							<Button type="submit" variant="solid">
								{kind === "chapter"
									? t.units.content.newChapter
									: t.units.content.newLabel}
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>
			{destinationDialogOpen ? (
				<BookContentStructureDestinationDialog
					description={t.units.content.choosePositionDescription}
					nodes={nodes}
					onClose={() => setDestinationDialogOpen(false)}
					onSelect={(nextDestination) => {
						setDestination(nextDestination);
						setDestinationDialogOpen(false);
					}}
					selectedDestination={destination}
					title={t.units.content.choosePosition}
				/>
			) : null}
		</>
	);
}

type CreatePlacement = {
	readonly parentId: string | null;
	readonly insertAfterId?: string;
};

function resolveCreatePlacement(
	nodes: readonly BookDraftNode[],
	destination: BookStructureDestination,
): CreatePlacement | undefined {
	if (destination.kind === "root") return { parentId: null };
	const target = nodes.find(({ id }) => id === destination.nodeId);
	if (!target) return undefined;
	if (destination.placement === "inside")
		return isBookDraftParentTarget(target) ? { parentId: target.id } : undefined;
	return { parentId: target.parentId, insertAfterId: target.id };
}

function structureDestinationLabel(
	nodes: readonly BookDraftNode[],
	destination: BookStructureDestination,
	rootLabel: string,
): string {
	if (destination.kind === "root") return rootLabel;
	return nodes.find(({ id }) => id === destination.nodeId)?.title ?? rootLabel;
}

function BookContentStructureTree({
	nodes,
	pending,
	onChange,
	onCreate,
	onOpenChapter,
	ownContentMetricsByNodeId,
}: StructureTreeProps) {
	const { t } = useTranslation(["units"]);
	const tree = useMemo(() => buildBookDraftTree(nodes), [nodes]);
	const siblingsByParentId = useMemo(() => groupSiblings(nodes), [nodes]);
	const allExpandableIds = useMemo(() => collectLabelIds(tree), [tree]);
	const expandableIdSet = useMemo(() => new Set(allExpandableIds), [allExpandableIds]);
	const contentMetricsByNodeId = useMemo(
		() => indexSubtreeContentMetrics(tree, ownContentMetricsByNodeId),
		[tree, ownContentMetricsByNodeId],
	);
	const [expandedIds, setExpandedIds] = useState<ReadonlySet<string>>(
		() => new Set(allExpandableIds),
	);
	const [renamingNode, setRenamingNode] = useState<BookDraftNode>();
	const [draggingIds, setDraggingIds] = useState<ReadonlySet<string>>(EmptyIdSet);
	const [dropTarget, setDropTarget] = useState<ActiveDropTarget>();
	const [selectionMode, setSelectionMode] = useState(false);
	const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(EmptyIdSet);
	const [selectionAnchorId, setSelectionAnchorId] = useState<string>();
	const [movingIds, setMovingIds] = useState<ReadonlySet<string>>();
	const visibleNodeIds = useMemo(
		() => collectVisibleNodeIds(tree, expandedIds),
		[tree, expandedIds],
	);
	const validDropTargetIds = useMemo(
		() =>
			draggingIds.size ? getBookDraftMoveTargetIds(nodes, draggingIds) : new Set<string>(),
		[nodes, draggingIds],
	);
	const { chapterCount, labelCount } = countDisplayedKinds(tree);

	function requestCreate(request: CreateRequest) {
		if (request.destination.kind === "node" && request.destination.placement === "inside") {
			const { nodeId } = request.destination;
			setExpandedIds((current) => new Set([...current, nodeId]));
		}
		onCreate(request);
	}

	function finishDrag() {
		setDraggingIds(EmptyIdSet);
		setDropTarget(undefined);
	}

	function changeDropTarget(next: BookDraftDropTarget) {
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

	function drop(target: BookDraftDropTarget) {
		if (!draggingIds.size) return;
		onChange((current) => moveBookDraftSelection(current, draggingIds, target));
		if (target.kind === "node" && target.placement === "inside")
			setExpandedIds((current) => new Set([...current, target.nodeId]));
		finishDrag();
	}

	function actionIds(nodeId: string): ReadonlySet<string> {
		return selectionMode && selectedIds.has(nodeId) ? selectedIds : new Set([nodeId]);
	}

	function moveToEdge(nodeId: string, edge: "first" | "last") {
		const ids = actionIds(nodeId);
		onChange((current) => moveBookDraftSelectionToSiblingEdge(current, ids, edge));
	}

	function requestMove(nodeId: string) {
		setMovingIds(new Set(actionIds(nodeId)));
	}

	function startDrag(nodeId: string) {
		setDraggingIds(new Set(actionIds(nodeId)));
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
		setSelectedIds(EmptyIdSet);
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
			else onOpenChapter(nodeId);
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
				setSelectedIds((current) =>
					modifiers.ctrlKey || modifiers.metaKey
						? new Set([...current, ...range])
						: new Set(range),
				);
				return;
			}
		}

		setSelectedIds((current) => {
			const next = new Set(current);
			if (next.has(nodeId)) next.delete(nodeId);
			else next.add(nodeId);
			return next;
		});
		setSelectionAnchorId(nodeId);
	}

	function contextTarget(nodeId: string) {
		if (!selectionMode || selectedIds.has(nodeId)) return;
		setSelectedIds(new Set([nodeId]));
		setSelectionAnchorId(nodeId);
	}

	function requestMainChapter() {
		const lastLabelId = findLastBookDraftLabelId(nodes);
		requestCreate({
			kind: "chapter",
			destination: lastLabelId
				? { kind: "node", nodeId: lastLabelId, placement: "inside" }
				: { kind: "root" },
		});
	}

	return (
		<>
			<Card appearance="outlined">
				<CardContent className="p-0">
					<div className="flex min-h-18 flex-wrap items-center justify-between gap-4 border-b border-border-weak px-5 py-4">
						<div className="min-w-0">
							<h2 className="font-heading font-semibold text-lg">
								{t.units.content.title}
							</h2>
							<p className="mt-1 text-muted-foreground text-sm">
								{t.units.content.structureSummary({
									chapters: chapterCount,
									labels: labelCount,
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
									? t.units.content.selectedCount({ count: selectedIds.size })
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
									requestCreate({ kind: "label", destination: { kind: "root" } })
								}
								type="button"
								variant="outline"
							>
								<ListTree aria-hidden />
								{t.units.content.newLabel}
							</Button>
							<Button
								disabled={pending}
								onClick={requestMainChapter}
								type="button"
								variant="solid"
							>
								<Plus aria-hidden />
								{t.units.content.newChapter}
							</Button>
						</div>
					</div>
					<div className="min-h-[36rem]">
						{draggingIds.size ? (
							<div
								className={cn(
									"relative flex min-h-24 items-center gap-3 border-b border-border-weak px-4 transition-colors",
									"bg-muted/20",
									dropTarget?.kind === "root" &&
										"bg-primary/8 outline-2 outline-primary -outline-offset-2",
								)}
								onDragOver={(event) => {
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
									<BookOpenText aria-hidden className="size-5" />
								</div>
								<p className="min-w-0 flex-1 truncate font-heading font-semibold text-base">
									{t.units.content.root}
								</p>
							</div>
						) : null}
						{tree.length ? (
							<ul aria-label={t.units.content.title} className="m-0 list-none p-0">
								{tree.map((entry) => (
									<BookContentStructureRow
										depth={0}
										draggingIds={draggingIds}
										dropTarget={dropTarget}
										entry={entry}
										expandedIds={expandedIds}
										key={entry.node.id}
										contentMetricsByNodeId={contentMetricsByNodeId}
										selectedIds={selectedIds}
										selectionMode={selectionMode}
										onActivate={activate}
										onContextTarget={contextTarget}
										onCreate={requestCreate}
										onDragEnd={finishDrag}
										onDragStart={startDrag}
										onDrop={drop}
										onDropTargetChange={changeDropTarget}
										onMoveRequest={requestMove}
										onMoveToEdge={moveToEdge}
										onRename={setRenamingNode}
										onToggle={toggle}
										pending={pending}
										siblingsByParentId={siblingsByParentId}
										validDropTargetIds={validDropTargetIds}
									/>
								))}
							</ul>
						) : (
							<div className="grid min-h-72 place-items-center px-6 text-center">
								<div>
									<ListTree
										aria-hidden
										className="mx-auto size-8 text-muted-foreground"
									/>
									<p className="mt-3 text-muted-foreground text-sm">
										{t.units.content.noContent}
									</p>
								</div>
							</div>
						)}
					</div>
				</CardContent>
			</Card>
			{renamingNode ? (
				<RenameStructureNodeDialog
					node={renamingNode}
					onClose={() => setRenamingNode(undefined)}
					onRename={(title) => {
						onChange((current) => renameBookDraftNode(current, renamingNode.id, title));
						setRenamingNode(undefined);
					}}
				/>
			) : null}
			{movingIds ? (
				<BookContentStructureDestinationDialog
					description={t.units.content.moveDescription}
					nodes={nodes}
					onClose={() => setMovingIds(undefined)}
					onSelect={(destination) => {
						onChange((current) =>
							moveBookDraftSelection(current, movingIds, destination),
						);
						if (destination.kind === "node" && destination.placement === "inside")
							setExpandedIds((current) => new Set([...current, destination.nodeId]));
						setMovingIds(undefined);
					}}
					title={t.units.content.move}
					validTargetIds={getBookDraftMoveTargetIds(nodes, movingIds)}
				/>
			) : null}
		</>
	);
}

function collectLabelIds(nodes: readonly BookDraftTreeNode[]): string[] {
	return nodes.flatMap(({ node, children }) =>
		isDisplayLabel(node, children)
			? [node.id, ...collectLabelIds(children)]
			: collectLabelIds(children),
	);
}

function collectVisibleNodeIds(
	nodes: readonly BookDraftTreeNode[],
	expandedIds: ReadonlySet<string>,
): string[] {
	return nodes.flatMap(({ node, children }) => [
		node.id,
		...(expandedIds.has(node.id) ? collectVisibleNodeIds(children, expandedIds) : []),
	]);
}

function groupSiblings(
	nodes: readonly BookDraftNode[],
): ReadonlyMap<string | null, readonly BookDraftNode[]> {
	const groups = new Map<string | null, BookDraftNode[]>();
	for (const node of nodes)
		groups.set(node.parentId, [...(groups.get(node.parentId) ?? []), node]);
	for (const siblings of groups.values())
		siblings.sort((left, right) => left.order - right.order || left.id.localeCompare(right.id));
	return groups;
}

function countDisplayedKinds(nodes: readonly BookDraftTreeNode[]): {
	readonly chapterCount: number;
	readonly labelCount: number;
} {
	let chapterCount = 0;
	let labelCount = 0;
	for (const { node, children } of nodes) {
		if (isDisplayLabel(node, children)) labelCount += 1;
		else chapterCount += 1;
		const childCounts = countDisplayedKinds(children);
		chapterCount += childCounts.chapterCount;
		labelCount += childCounts.labelCount;
	}
	return { chapterCount, labelCount };
}

function indexSubtreeContentMetrics(
	nodes: readonly BookDraftTreeNode[],
	ownContentMetricsByNodeId: ReadonlyMap<string, ContentMetrics>,
): ReadonlyMap<string, ContentMetrics> {
	const contentMetricsByNodeId = new Map<string, ContentMetrics>();

	function visit({ node, children }: BookDraftTreeNode): ContentMetrics {
		const own = ownContentMetricsByNodeId.get(node.id) ?? EmptyContentMetrics;
		let wordCount = own.wordCount;
		let characterCount = own.characterCount;
		for (const child of children) {
			const childMetrics = visit(child);
			wordCount += childMetrics.wordCount;
			characterCount += childMetrics.characterCount;
		}
		const total = { wordCount, characterCount };
		contentMetricsByNodeId.set(node.id, total);
		return total;
	}

	for (const node of nodes) visit(node);
	return contentMetricsByNodeId;
}

function indexOwnContentMetrics(
	nodes: BookStructureResponse["items"],
): ReadonlyMap<string, ContentMetrics> {
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

function isDisplayLabel(node: BookDraftNode, children: readonly BookDraftTreeNode[]): boolean {
	return node.contentKind === "chapter_group" || children.length > 0;
}

/**
 * @todo Render the persisted chapter view count beside this affordance after
 * durable per-chapter readership records are available from the structure API.
 */
function ChapterViewMetric({ label }: { label: string }) {
	return (
		<span aria-label={label} className="inline-flex items-center" role="img" title={label}>
			<Eye aria-hidden className="size-4" />
		</span>
	);
}

function BookContentStructureRow(props: StructureRowProps) {
	const {
		entry,
		depth,
		siblingsByParentId,
		pending,
		expandedIds,
		draggingIds,
		dropTarget,
		validDropTargetIds,
		contentMetricsByNodeId,
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
	const { node, children } = entry;
	const displayAsLabel = isDisplayLabel(node, children);
	const acceptsChildren = isBookDraftParentTarget(node);
	const expanded = expandedIds.has(node.id);
	const canDrop = validDropTargetIds.has(node.id);
	const selected = selectedIds.has(node.id);
	const siblings = siblingsByParentId.get(node.parentId) ?? [];
	const siblingIndex = siblings.findIndex(({ id }) => id === node.id);
	const activePlacement =
		dropTarget?.kind === "node" && dropTarget.nodeId === node.id
			? dropTarget.placement
			: undefined;
	const contentMetrics = contentMetricsByNodeId.get(node.id) ?? EmptyContentMetrics;
	const rowStyle = {
		paddingInlineStart: `${1 + depth * 2}rem`,
	} satisfies CSSProperties;

	function placement(event: DragEvent<HTMLDivElement>): "before" | "inside" | "after" {
		const bounds = event.currentTarget.getBoundingClientRect();
		const ratio = bounds.height ? (event.clientY - bounds.top) / bounds.height : 0.5;
		if (!acceptsChildren) return ratio < 0.5 ? "before" : "after";
		return ratio < 0.25 ? "before" : ratio > 0.75 ? "after" : "inside";
	}

	const row = (
		<div
			className={cn(
				"group/structure-row relative flex min-h-24 items-center gap-3 pe-3 transition-colors",
				draggingIds.has(node.id) && "opacity-45",
				activePlacement === "before" && "border-t-2 border-t-primary",
				activePlacement === "inside" &&
					"bg-primary/8 outline-2 outline-primary -outline-offset-2",
				activePlacement === "after" && "border-b-2 border-b-primary",
				!activePlacement && !selected && "hover:bg-muted/40",
				selected && "bg-accent/70",
			)}
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
			onContextMenu={() => onContextTarget(node.id)}
			style={rowStyle}
		>
			{depth > 0 ? (
				<span
					aria-hidden
					className="absolute inset-y-0 w-px bg-border-weak"
					style={{ insetInlineStart: `${depth * 2}rem` }}
				/>
			) : null}
			<span
				aria-hidden
				className="pointer-events-none absolute bottom-0 h-px bg-border-weak"
				style={{
					insetInlineEnd: 0,
					insetInlineStart: depth > 0 ? `${depth * 2}rem` : 0,
				}}
			/>
			<button
				aria-expanded={displayAsLabel ? expanded : undefined}
				aria-pressed={selectionMode ? selected : undefined}
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
				<span className="min-w-0 flex-1">
					<span className="flex min-w-0 items-center gap-2">
						{displayAsLabel ? (
							<ChevronRight
								aria-hidden
								className={cn(
									"size-4 shrink-0 text-muted-foreground transition-transform motion-reduce:transition-none",
									expanded && "rotate-90",
								)}
							/>
						) : null}
						<span className="truncate font-heading font-semibold text-base text-foreground">
							{node.title}
						</span>
					</span>
					<span className="mt-2 flex items-center gap-4 text-muted-foreground text-sm">
						{displayAsLabel ? (
							<span>{t.units.content.childCount({ count: children.length })}</span>
						) : null}
						<span className="inline-flex items-center gap-1.5">
							<Text aria-hidden className="size-4" />
							{node.language === "zh"
								? displayAsLabel
									? t.units.content.totalCharacterCount({
											count: contentMetrics.characterCount,
										})
									: t.units.chapter.characterCount({
											count: contentMetrics.characterCount,
										})
								: displayAsLabel
									? t.units.content.totalWordCount({
											count: contentMetrics.wordCount,
										})
									: t.units.chapter.wordCount({
											count: contentMetrics.wordCount,
										})}
						</span>
						{displayAsLabel ? null : (
							<ChapterViewMetric label={t.units.content.views} />
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
				<SelectionActionMenu
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
				<NodeActionMenu
					canMoveToFirst={siblingIndex > 0}
					canMoveToLast={siblingIndex >= 0 && siblingIndex < siblings.length - 1}
					displayAsLabel={displayAsLabel}
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
		</div>
	);

	return (
		<li className="m-0 list-none p-0">
			<ContextMenu>
				<ContextMenuTrigger asChild>{row}</ContextMenuTrigger>
				<ContextMenuContent>
					{selectionMode ? (
						<SelectionContextMenuItems
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
						<NodeContextMenuItems
							canMoveToFirst={siblingIndex > 0}
							canMoveToLast={siblingIndex >= 0 && siblingIndex < siblings.length - 1}
							displayAsLabel={displayAsLabel}
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
			{displayAsLabel && expanded && children.length ? (
				<ul className="m-0 list-none p-0">
					{children.map((child) => (
						<BookContentStructureRow
							{...props}
							depth={depth + 1}
							entry={child}
							key={child.node.id}
						/>
					))}
				</ul>
			) : null}
		</li>
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

function SelectionActionMenu({
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

function SelectionContextMenuItems({
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

function NodeActionMenu({
	node,
	displayAsLabel,
	expanded,
	canMoveToFirst,
	canMoveToLast,
	pending,
	onCreate,
	onMoveRequest,
	onMoveToEdge,
	onRename,
	onToggle,
}: {
	node: BookDraftNode;
	displayAsLabel: boolean;
	expanded: boolean;
	canMoveToFirst: boolean;
	canMoveToLast: boolean;
	pending: boolean;
	onCreate: (request: CreateRequest) => void;
	onMoveRequest: (nodeId: string) => void;
	onMoveToEdge: (nodeId: string, edge: "first" | "last") => void;
	onRename: (node: BookDraftNode) => void;
	onToggle: (nodeId: string) => void;
}) {
	const { t } = useTranslation(["units"]);
	const destination = bookStructureDestinationForNode(node);
	const createAsChild = destination.placement === "inside";

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
					onSelect={() =>
						onCreate({
							kind: "chapter",
							destination,
						})
					}
					value="new-chapter"
				>
					<FileText aria-hidden />
					{createAsChild ? t.units.content.newChapter : t.units.content.newChapterAfter}
				</MenuItem>
				<MenuItem
					onSelect={() =>
						onCreate({
							kind: "label",
							destination,
						})
					}
					value="new-label"
				>
					<ListTree aria-hidden />
					{createAsChild ? t.units.content.newLabel : t.units.content.newLabelAfter}
				</MenuItem>
				{displayAsLabel ? (
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

function NodeContextMenuItems({
	node,
	displayAsLabel,
	expanded,
	canMoveToFirst,
	canMoveToLast,
	pending,
	onCreate,
	onMoveRequest,
	onMoveToEdge,
	onRename,
	onToggle,
}: {
	node: BookDraftNode;
	displayAsLabel: boolean;
	expanded: boolean;
	canMoveToFirst: boolean;
	canMoveToLast: boolean;
	pending: boolean;
	onCreate: (request: CreateRequest) => void;
	onMoveRequest: (nodeId: string) => void;
	onMoveToEdge: (nodeId: string, edge: "first" | "last") => void;
	onRename: (node: BookDraftNode) => void;
	onToggle: (nodeId: string) => void;
}) {
	const { t } = useTranslation(["units"]);
	const destination = bookStructureDestinationForNode(node);
	const createAsChild = destination.placement === "inside";

	return (
		<>
			<ContextMenuItem
				disabled={pending}
				onSelect={() =>
					onCreate({
						kind: "chapter",
						destination,
					})
				}
				value="context-new-chapter"
			>
				<FileText aria-hidden />
				{createAsChild ? t.units.content.newChapter : t.units.content.newChapterAfter}
			</ContextMenuItem>
			<ContextMenuItem
				disabled={pending}
				onSelect={() =>
					onCreate({
						kind: "label",
						destination,
					})
				}
				value="context-new-label"
			>
				<ListTree aria-hidden />
				{createAsChild ? t.units.content.newLabel : t.units.content.newLabelAfter}
			</ContextMenuItem>
			{displayAsLabel ? (
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

function RenameStructureNodeDialog({
	node,
	onClose,
	onRename,
}: {
	node: BookDraftNode;
	onClose: () => void;
	onRename: (title: string) => void;
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
