"use client";

import { toContentLanguage } from "@rezics/i18n";
import {
	type GetApiUnitsBookByUnitIdContentStructureNodesStatus200,
	usePutApiUnitsBookByUnitIdContentStructure,
} from "@rezics/openapi-tanstack-query";
import type { PortableTextValue } from "@rezics/portable-text";
import { useQueryClient } from "@tanstack/react-query";
import {
	ArrowDown,
	ArrowUp,
	Ellipsis,
	FileText,
	Folder,
	GripVertical,
	HistoryIcon,
	IndentDecrease,
	IndentIncrease,
	Move,
	Pencil,
	Save,
	Undo2,
} from "lucide-react";
import Link from "next/link";
import { type DragEvent, type FormEvent, useMemo, useState } from "react";

import {
	Button,
	Card,
	CardContent,
	cn,
	createTreeCollection,
	Field,
	FieldGroup,
	FieldLabel,
	Input,
	Menu,
	MenuContent,
	MenuItem,
	MenuTrigger,
	NativeSelect,
	NativeSelectOption,
	TreeEditor,
	TreeViewBranch,
	TreeViewBranchContent,
	TreeViewBranchItem,
	TreeViewContent,
	TreeViewItem,
	TreeViewNode,
	type TreeNodeType,
} from "@rezics/ui";
import { PortableTextEditor } from "@/features/editor/portable-text-editor";
import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import { writePortableText } from "@/lib/block";
import { invalidateBookContentStructure } from "../unit-cache";
import {
	addBookDraftNode,
	bookContentStructureDraftFingerprint,
	buildBookDraftTree,
	createBookContentStructureDraft,
	getBookDraftMoveTargetIds,
	moveBookDraftSelection,
	renameBookDraftNode,
	toBookContentStructureSaveNodes,
	type BookDraftDropTarget,
	type BookDraftNode,
	type BookDraftTreeNode,
	type NewBookDraftNodeInput,
} from "../model/book-content-structure-draft";
import { BookContentStructureMoveDialog } from "./book-content-structure-move-dialog";
import { UnitSectionHeader } from "./unit-section-header";
import {
	bookContentStructureHistoryHref,
	chapterEditorHref,
} from "../routing/unit-management-routes";

type BookStructureResponse = GetApiUnitsBookByUnitIdContentStructureNodesStatus200;

type EditorDocument = {
	readonly baseRevisionId: string;
	readonly baseline: readonly BookDraftNode[];
	readonly draft: readonly BookDraftNode[];
};

type EditorTreeNode = Omit<TreeNodeType, "children"> & {
	readonly draftNode?: BookDraftNode;
	readonly children?: EditorTreeNode[];
};

type ActiveDropTarget =
	| { readonly kind: "root" }
	| {
			readonly kind: "node";
			readonly nodeId: string;
			readonly placement: "before" | "inside" | "after";
	  };

function toEditorTreeNodes(nodes: readonly BookDraftTreeNode[]): EditorTreeNode[] {
	return nodes.map(({ node, children }) => ({
		id: node.id,
		name: node.title,
		draftNode: node,
		...(children.length ? { children: toEditorTreeNodes(children) } : {}),
	}));
}

function expandedNodeIds(nodes: readonly EditorTreeNode[]): string[] {
	return nodes.flatMap((node) =>
		node.children?.length ? [node.id, ...expandedNodeIds(node.children)] : [],
	);
}

function flattenWithDepth(
	nodes: readonly BookDraftTreeNode[],
	depth = 0,
): { readonly node: BookDraftNode; readonly depth: number }[] {
	return nodes.flatMap((entry) => [
		{ node: entry.node, depth },
		...flattenWithDepth(entry.children, depth + 1),
	]);
}

export function BookContentStructureEditor({
	bookId,
	initial,
}: {
	bookId: string;
	initial: BookStructureResponse & { structureId: string; latestRevisionId: string };
}) {
	const { t } = useTranslation(["engagement", "units"]);
	const queryClient = useQueryClient();
	const initialDraft = useMemo(() => createBookContentStructureDraft(initial.items), [initial]);
	const [document, setDocument] = useState<EditorDocument>({
		baseRevisionId: initial.latestRevisionId,
		baseline: initialDraft,
		draft: initialDraft,
	});
	const [selectedValue, setSelectedValue] = useState<string[]>([]);
	const [moveDialogOpen, setMoveDialogOpen] = useState(false);
	const [renamingId, setRenamingId] = useState<string>();
	const save = usePutApiUnitsBookByUnitIdContentStructure();
	const dirty =
		bookContentStructureDraftFingerprint(document.draft) !==
		bookContentStructureDraftFingerprint(document.baseline);
	const selectedIds = useMemo(() => new Set(selectedValue), [selectedValue]);

	async function saveDraft() {
		if (!dirty || save.isPending) return;
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
			});
			setSelectedValue([]);
			setRenamingId(undefined);
			void invalidateBookContentStructure(queryClient, bookId);
		} catch {
			// The typed mutation renders the visible request failure.
		}
	}

	return (
		<section>
			<UnitSectionHeader
				action={
					<>
						<Button
							aria-label={t.units.content.discardDraft}
							disabled={!dirty || save.isPending}
							onClick={() => {
								setDocument((current) => ({
									...current,
									draft: current.baseline,
								}));
								setSelectedValue([]);
								setRenamingId(undefined);
							}}
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
			<div className="grid gap-6">
				<p className="text-sm text-muted-foreground">{t.units.content.draftHint}</p>
				{dirty ? (
					<p className="text-sm font-medium text-primary">
						{t.units.content.unsavedDraft}
					</p>
				) : null}
				<BookContentCreateForm
					nodes={document.draft}
					onCreate={(node) =>
						setDocument((current) => ({
							...current,
							draft: addBookDraftNode(current.draft, node),
						}))
					}
				/>
				<BookContentStructureTree
					bookId={bookId}
					nodes={document.draft}
					onChange={(change) =>
						setDocument((current) => ({
							...current,
							draft: change(current.draft),
						}))
					}
					onMoveRequest={(nodeId) => {
						setSelectedValue((current) =>
							current.includes(nodeId) ? current : [nodeId],
						);
						setMoveDialogOpen(true);
					}}
					onRenameRequest={setRenamingId}
					onSelectionChange={setSelectedValue}
					pending={save.isPending}
					renamingId={renamingId}
					selectedValue={selectedValue}
				/>
				<RequestFailure error={save.error} />
			</div>
			{moveDialogOpen ? (
				<BookContentStructureMoveDialog
					nodes={document.draft}
					onClose={() => setMoveDialogOpen(false)}
					onMove={(parentId) =>
						setDocument((current) => ({
							...current,
							draft: moveBookDraftSelection(
								current.draft,
								selectedIds,
								parentId === null
									? { kind: "root" }
									: { kind: "node", nodeId: parentId, placement: "inside" },
							),
						}))
					}
					selectedIds={selectedIds}
				/>
			) : null}
		</section>
	);
}

function BookContentCreateForm({
	nodes,
	onCreate,
}: {
	nodes: readonly BookDraftNode[];
	onCreate: (node: NewBookDraftNodeInput) => void;
}) {
	const { t, locale } = useTranslation(["units", "ui"]);
	const [kind, setKind] = useState<"chapter" | "group">("chapter");
	const [content, setContent] = useState<PortableTextValue>([]);
	const [editorKey, setEditorKey] = useState(0);
	const flatNodes = flattenWithDepth(buildBookDraftTree(nodes));

	function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const element = event.currentTarget;
		const form = new FormData(element);
		const title = String(form.get("title") ?? "").trim();
		if (!title) return;
		const parentId = String(form.get("parentId") ?? "") || null;
		const common = {
			state: "new" as const,
			id: crypto.randomUUID(),
			parentId,
			title,
			language: toContentLanguage(locale.target),
		};
		onCreate(
			kind === "chapter"
				? {
						...common,
						contentKind: "chapter",
						content: writePortableText(content),
						status: form.get("status") === "draft" ? "draft" : "published",
					}
				: { ...common, contentKind: "chapter_group" },
		);
		element.reset();
		setContent([]);
		setEditorKey((current) => current + 1);
	}

	return (
		<Card appearance="outlined">
			<CardContent className="p-6">
				<form onSubmit={submit}>
					<FieldGroup>
						<h2 className="font-heading text-xl font-bold">{t.units.content.create}</h2>
						<Field>
							<FieldLabel>{t.units.content.create}</FieldLabel>
							<NativeSelect
								name="kind"
								onChange={(event) =>
									setKind(
										event.currentTarget.value === "group" ? "group" : "chapter",
									)
								}
								value={kind}
							>
								<NativeSelectOption value="chapter">
									{t.units.content.chapter}
								</NativeSelectOption>
								<NativeSelectOption value="group">
									{t.units.content.group}
								</NativeSelectOption>
							</NativeSelect>
						</Field>
						<Field required>
							<FieldLabel>{t.ui.title}</FieldLabel>
							<Input maxLength={500} name="title" required />
						</Field>
						<Field>
							<FieldLabel>{t.units.content.parent}</FieldLabel>
							<NativeSelect name="parentId">
								<NativeSelectOption value="">
									{t.units.content.root}
								</NativeSelectOption>
								{flatNodes.map(({ node, depth }) => (
									<NativeSelectOption key={node.id} value={node.id}>
										{"— ".repeat(depth)}
										{node.title}
									</NativeSelectOption>
								))}
							</NativeSelect>
						</Field>
						{kind === "chapter" ? (
							<>
								<Field>
									<FieldLabel>{t.ui.status}</FieldLabel>
									<NativeSelect defaultValue="published" name="status">
										<NativeSelectOption value="published">
											{t.ui.published}
										</NativeSelectOption>
										<NativeSelectOption value="draft">
											{t.ui.draft}
										</NativeSelectOption>
									</NativeSelect>
								</Field>
								<PortableTextEditor
									key={editorKey}
									label={t.ui.chapterContent}
									onChange={setContent}
									value={content}
									variant="document"
								/>
							</>
						) : null}
						<Button type="submit" variant="solid">
							{kind === "chapter"
								? t.units.content.createChapter
								: t.units.content.createGroup}
						</Button>
					</FieldGroup>
				</form>
			</CardContent>
		</Card>
	);
}

function BookContentStructureTree({
	bookId,
	nodes,
	selectedValue,
	renamingId,
	pending,
	onChange,
	onMoveRequest,
	onRenameRequest,
	onSelectionChange,
}: {
	bookId: string;
	nodes: readonly BookDraftNode[];
	selectedValue: readonly string[];
	renamingId?: string;
	pending: boolean;
	onChange: (change: (nodes: readonly BookDraftNode[]) => BookDraftNode[]) => void;
	onMoveRequest: (nodeId: string) => void;
	onRenameRequest: (nodeId: string | undefined) => void;
	onSelectionChange: (ids: string[]) => void;
}) {
	const { t } = useTranslation(["engagement", "units", "ui"]);
	const [draggingSelection, setDraggingSelection] = useState<readonly string[]>([]);
	const [dropTarget, setDropTarget] = useState<ActiveDropTarget>();
	const selectedIds = useMemo(() => new Set(selectedValue), [selectedValue]);
	const tree = useMemo(() => buildBookDraftTree(nodes), [nodes]);
	const editorNodes = useMemo(() => toEditorTreeNodes(tree), [tree]);
	const collection = createTreeCollection<EditorTreeNode>({
		rootNode: {
			id: "book-content-structure-root",
			name: "",
			children: editorNodes,
		},
	});
	const draggingIds = useMemo(() => new Set(draggingSelection), [draggingSelection]);
	const validDropTargetIds = useMemo(
		() => getBookDraftMoveTargetIds(nodes, draggingIds),
		[nodes, draggingIds],
	);
	const renamingNode = renamingId ? nodes.find(({ id }) => id === renamingId) : undefined;

	function finishDrag() {
		setDraggingSelection([]);
		setDropTarget(undefined);
	}

	function drop(target: BookDraftDropTarget) {
		if (!draggingIds.size) return;
		onChange((current) => moveBookDraftSelection(current, draggingIds, target));
		finishDrag();
	}

	function rowSelection(nodeId: string): ReadonlySet<string> {
		if (selectedIds.has(nodeId)) return selectedIds;
		onSelectionChange([nodeId]);
		return new Set([nodeId]);
	}

	function moveSingle(nodeId: string, target: BookDraftDropTarget) {
		onChange((current) => moveBookDraftSelection(current, new Set([nodeId]), target));
	}

	return (
		<Card appearance="outlined">
			<CardContent className="p-0">
				<div className="flex min-h-14 flex-wrap items-center justify-between gap-3 border-b border-border-weak px-4 py-3">
					<span className="text-sm text-muted-foreground">
						{selectedValue.length
							? t.units.content.selectedCount({ count: selectedValue.length })
							: t.units.content.title}
					</span>
					<div className="flex items-center gap-2">
						<Button
							disabled={!selectedValue.length || pending}
							onClick={() => {
								const firstSelectedId = selectedValue[0];

								if (firstSelectedId !== undefined) {
									onMoveRequest(firstSelectedId);
								}
							}}
							size="sm"
							type="button"
							variant="outline"
						>
							<Move aria-hidden />
							{t.units.content.moveSelection}
						</Button>
						<Button
							disabled={!selectedValue.length || pending}
							onClick={() => onSelectionChange([])}
							size="sm"
							type="button"
							variant="quiet"
						>
							{t.units.content.clearSelection}
						</Button>
					</div>
				</div>
				{draggingSelection.length ? (
					<div
						className={cn(
							"m-3 rounded-lg border border-dashed px-4 py-3 text-center text-sm text-muted-foreground",
							dropTarget?.kind === "root" &&
								"border-primary bg-primary/5 text-foreground",
						)}
						onDragOver={(event) => {
							event.preventDefault();
							setDropTarget({ kind: "root" });
						}}
						onDrop={(event) => {
							event.preventDefault();
							drop({ kind: "root" });
						}}
					>
						{t.units.content.root}
					</div>
				) : null}
				{nodes.length ? (
					<div className="p-3">
						<TreeEditor
							collection={collection}
							defaultExpandedValue={expandedNodeIds(editorNodes)}
							label={t.units.content.title}
							onSelectionChange={({ selectedValue: next }) => onSelectionChange(next)}
							renderNode={(node, indexPath) => (
								<BookContentStructureRow
									bookId={bookId}
									draggingIds={draggingIds}
									dropTarget={dropTarget}
									indexPath={indexPath}
									key={node.id}
									node={node}
									nodes={nodes}
									onDragEnd={finishDrag}
									onDragStart={(nodeId) => {
										const selection = rowSelection(nodeId);
										setDraggingSelection([...selection]);
									}}
									onDrop={(target) => drop(target)}
									onDropTargetChange={setDropTarget}
									onMoveRequest={onMoveRequest}
									onRenameRequest={onRenameRequest}
									onSingleMove={moveSingle}
									pending={pending}
									selectedIds={selectedIds}
									validDropTargetIds={validDropTargetIds}
								/>
							)}
							selectedValue={[...selectedValue]}
							selectionMode="multiple"
						/>
					</div>
				) : (
					<p className="p-6 text-sm text-muted-foreground">{t.units.content.noContent}</p>
				)}
				{renamingNode ? (
					<form
						className="flex flex-wrap items-end gap-3 border-t border-border-weak p-4"
						onSubmit={(event) => {
							event.preventDefault();
							const form = new FormData(event.currentTarget);
							const title = String(form.get("title") ?? "").trim();
							if (!title) return;
							onChange((current) =>
								renameBookDraftNode(current, renamingNode.id, title),
							);
							onRenameRequest(undefined);
						}}
					>
						<Field className="min-w-52 flex-1" required>
							<FieldLabel>{t.units.content.rename}</FieldLabel>
							<Input
								defaultValue={renamingNode.title}
								maxLength={500}
								name="title"
								required
							/>
						</Field>
						<Button size="sm" type="submit" variant="solid">
							{t.ui.save}
						</Button>
						<Button
							onClick={() => onRenameRequest(undefined)}
							size="sm"
							type="button"
							variant="quiet"
						>
							{t.engagement.cancel}
						</Button>
					</form>
				) : null}
			</CardContent>
		</Card>
	);
}

function BookContentStructureRow({
	bookId,
	node,
	indexPath,
	nodes,
	pending,
	selectedIds,
	draggingIds,
	dropTarget,
	validDropTargetIds,
	onDragStart,
	onDragEnd,
	onDropTargetChange,
	onDrop,
	onRenameRequest,
	onMoveRequest,
	onSingleMove,
}: {
	bookId: string;
	node: EditorTreeNode;
	indexPath: number[];
	nodes: readonly BookDraftNode[];
	pending: boolean;
	selectedIds: ReadonlySet<string>;
	draggingIds: ReadonlySet<string>;
	dropTarget?: ActiveDropTarget;
	validDropTargetIds: ReadonlySet<string>;
	onDragStart: (nodeId: string) => void;
	onDragEnd: () => void;
	onDropTargetChange: (target: ActiveDropTarget) => void;
	onDrop: (target: BookDraftDropTarget) => void;
	onRenameRequest: (nodeId: string) => void;
	onMoveRequest: (nodeId: string) => void;
	onSingleMove: (nodeId: string, target: BookDraftDropTarget) => void;
}) {
	const { t } = useTranslation(["units"]);
	const contentNode = node.draftNode;
	if (!contentNode) return null;
	const canDrop = validDropTargetIds.has(node.id);
	const siblings = nodes
		.filter(({ parentId }) => parentId === contentNode.parentId)
		.toSorted((left, right) => left.order - right.order);
	const siblingIndex = siblings.findIndex(({ id }) => id === node.id);
	const activePlacement =
		dropTarget?.kind === "node" && dropTarget.nodeId === node.id
			? dropTarget.placement
			: undefined;
	const rowClassName = cn(
		"pe-28",
		draggingIds.has(node.id) && "opacity-50",
		activePlacement === "before" && "border-t-2 border-t-primary",
		activePlacement === "inside" && "bg-primary/10 outline-2 outline-primary",
		activePlacement === "after" && "border-b-2 border-b-primary",
	);

	function placement(event: DragEvent<HTMLElement>) {
		const bounds = event.currentTarget.getBoundingClientRect();
		const ratio = bounds.height ? (event.clientY - bounds.top) / bounds.height : 0.5;
		return ratio < 0.25 ? "before" : ratio > 0.75 ? "after" : "inside";
	}

	const dragProps = {
		draggable: !pending,
		onDragStart: (event: DragEvent<HTMLElement>) => {
			event.dataTransfer.effectAllowed = "move";
			event.dataTransfer.setData("text/plain", node.id);
			onDragStart(node.id);
		},
		onDragEnd,
		onDragOver: (event: DragEvent<HTMLElement>) => {
			if (!canDrop) return;
			event.preventDefault();
			event.dataTransfer.dropEffect = "move";
			onDropTargetChange({ kind: "node", nodeId: node.id, placement: placement(event) });
		},
		onDrop: (event: DragEvent<HTMLElement>) => {
			if (!canDrop) return;
			event.preventDefault();
			onDrop({ kind: "node", nodeId: node.id, placement: placement(event) });
		},
	};
	const actions = (
		<div className="absolute end-2 top-1/2 z-2 flex -translate-y-1/2 items-center gap-1 rounded-md bg-background/90 opacity-100 backdrop-blur sm:opacity-0 sm:group-hover/editor-row:opacity-100 sm:group-focus-within/editor-row:opacity-100">
			<GripVertical aria-hidden className="mx-1 size-4 text-muted-foreground" />
			{contentNode.state === "existing" && contentNode.contentKind === "chapter" ? (
				<Button asChild size="xs" variant="quiet">
					<Link href={chapterEditorHref(bookId, contentNode.contentUnitId)}>
						{t.units.content.editChapter}
					</Link>
				</Button>
			) : null}
			<Menu>
				<MenuTrigger asChild>
					<Button
						aria-label={t.units.content.actions}
						disabled={pending}
						size="icon-xs"
						type="button"
						variant="quiet"
					>
						<Ellipsis aria-hidden />
					</Button>
				</MenuTrigger>
				<MenuContent>
					<MenuItem
						disabled={siblingIndex <= 0}
						onSelect={() => {
							const previous = siblings[siblingIndex - 1];
							if (previous)
								onSingleMove(node.id, {
									kind: "node",
									nodeId: previous.id,
									placement: "before",
								});
						}}
						value="earlier"
					>
						<ArrowUp aria-hidden />
						{t.units.content.moveEarlier}
					</MenuItem>
					<MenuItem
						disabled={siblingIndex < 0 || siblingIndex >= siblings.length - 1}
						onSelect={() => {
							const next = siblings[siblingIndex + 1];
							if (next)
								onSingleMove(node.id, {
									kind: "node",
									nodeId: next.id,
									placement: "after",
								});
						}}
						value="later"
					>
						<ArrowDown aria-hidden />
						{t.units.content.moveLater}
					</MenuItem>
					<MenuItem
						disabled={siblingIndex <= 0}
						onSelect={() => {
							const previous = siblings[siblingIndex - 1];
							if (previous)
								onSingleMove(node.id, {
									kind: "node",
									nodeId: previous.id,
									placement: "inside",
								});
						}}
						value="indent"
					>
						<IndentIncrease aria-hidden />
						{t.units.content.indent}
					</MenuItem>
					<MenuItem
						disabled={!contentNode.parentId}
						onSelect={() => {
							if (contentNode.parentId)
								onSingleMove(node.id, {
									kind: "node",
									nodeId: contentNode.parentId,
									placement: "after",
								});
						}}
						value="outdent"
					>
						<IndentDecrease aria-hidden />
						{t.units.content.outdent}
					</MenuItem>
					<MenuItem onSelect={() => onRenameRequest(node.id)} value="rename">
						<Pencil aria-hidden />
						{t.units.content.rename}
					</MenuItem>
					<MenuItem onSelect={() => onMoveRequest(node.id)} value="move">
						<Move aria-hidden />
						{selectedIds.has(node.id)
							? t.units.content.moveSelection
							: t.units.content.move}
					</MenuItem>
				</MenuContent>
			</Menu>
		</div>
	);

	return (
		<TreeViewNode indexPath={indexPath} node={node}>
			{node.children?.length ? (
				<TreeViewBranch>
					<div className="group/editor-row relative">
						<TreeViewBranchItem
							{...dragProps}
							className={rowClassName}
							expandedIcon={Folder}
							icon={Folder}
						>
							{node.name}
						</TreeViewBranchItem>
						{actions}
					</div>
					<TreeViewBranchContent>
						{node.children.map((child, index) => (
							<BookContentStructureRow
								bookId={bookId}
								draggingIds={draggingIds}
								dropTarget={dropTarget}
								indexPath={[...indexPath, index]}
								key={child.id}
								node={child}
								nodes={nodes}
								onDragEnd={onDragEnd}
								onDragStart={onDragStart}
								onDrop={onDrop}
								onDropTargetChange={onDropTargetChange}
								onMoveRequest={onMoveRequest}
								onRenameRequest={onRenameRequest}
								onSingleMove={onSingleMove}
								pending={pending}
								selectedIds={selectedIds}
								validDropTargetIds={validDropTargetIds}
							/>
						))}
					</TreeViewBranchContent>
				</TreeViewBranch>
			) : (
				<div className="group/editor-row relative">
					<TreeViewContent {...dragProps} className={rowClassName}>
						<TreeViewItem
							icon={contentNode.contentKind === "chapter" ? FileText : Folder}
						>
							{node.name}
						</TreeViewItem>
					</TreeViewContent>
					{actions}
				</div>
			)}
		</TreeViewNode>
	);
}
