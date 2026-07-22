"use client";

import { toContentLanguage } from "@rezics/i18n";

import {
	type GetApiUnitsBookByUnitIdContentStructureNodesStatus200,
	type PostApiUnitsBookByUnitIdContentStructureNodesOptions,
	useGetApiUnitsBookByUnitIdContentStructureNodes,
	usePatchApiUnitsBookByUnitIdContentStructureNodesByNodeId,
	usePostApiUnitsBookByUnitIdContentStructureNodes,
} from "@rezics/openapi-tanstack-query";
import type { PortableTextValue } from "@rezics/portable-text";
import { useQueryClient } from "@tanstack/react-query";
import { generateKeyBetween } from "fractional-indexing";
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
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState, type FormEvent } from "react";

import { Button } from "@rezics/ui";
import { Card, CardContent } from "@rezics/ui";
import {
	createTreeCollection,
	TreeEditor,
	TreeViewBranch,
	TreeViewBranchContent,
	TreeViewBranchItem,
	TreeViewContent,
	TreeViewItem,
	TreeViewNode,
	type TreeNodeType,
} from "@rezics/ui";
import { Field, FieldGroup, FieldLabel } from "@rezics/ui";
import { Input } from "@rezics/ui";
import { NativeSelect, NativeSelectOption } from "@rezics/ui";
import { QueryFailure, QueryPending } from "@rezics/ui";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@rezics/ui";
import { cn } from "@rezics/ui";
import { PortableTextEditor } from "@/features/editor/portable-text-editor";
import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import { writePortableText } from "@/lib/block";
import {
	buildContentStructureTree,
	getContentStructureDepthMove,
	getContentStructureMoveTargets,
	flattenContentStructureTree,
	type FlattenedContentStructureTreeNode,
} from "./content-structure-tree";
import { invalidateBookContentStructure } from "./unit-cache";
import { UnitSectionHeader } from "./components/unit-section-header";
import {
	bookContentStructureHistoryHref,
	chapterEditorHref,
} from "./routing/unit-management-routes";

type ContentStructureNode = GetApiUnitsBookByUnitIdContentStructureNodesStatus200["items"][number];

export function ContentStructureEdit({ bookId }: { bookId: string }) {
	return <BookContentStructureWorkspace bookId={bookId} />;
}

function BookContentStructureWorkspace({ bookId }: { bookId: string }) {
	const { t } = useTranslation(["create", "engagement", "errors", "ui", "units"]);
	const queryClient = useQueryClient();
	const tree = useGetApiUnitsBookByUnitIdContentStructureNodes({
		path: { unitId: bookId },
	});
	const create = usePostApiUnitsBookByUnitIdContentStructureNodes({
		mutation: { onSuccess: async () => invalidateBookContentStructure(queryClient, bookId) },
	});
	const update = usePatchApiUnitsBookByUnitIdContentStructureNodesByNodeId({
		mutation: { onSuccess: async () => invalidateBookContentStructure(queryClient, bookId) },
	});
	const nodes = tree.data?.items ?? [];
	const flattened = useMemo(
		() => flattenContentStructureTree(buildContentStructureTree(nodes)),
		[nodes],
	);
	if (tree.isPending) return <QueryPending />;
	if (tree.isError) return <QueryFailure error={tree.error} retry={() => void tree.refetch()} />;
	if (!tree.data?.structureId || !tree.data.latestRevisionId)
		return (
			<div className="grid min-h-64 w-full place-items-center">
				<p className="text-destructive text-sm">{t.ui.retryLater}</p>
			</div>
		);
	const baseRevisionId = tree.data.latestRevisionId;
	return (
		<section>
			<UnitSectionHeader
				action={
					<Button asChild size="icon-md" variant="outline">
						<Link
							aria-label={t.units.workspace.sections.history.label}
							href={bookContentStructureHistoryHref(bookId)}
						>
							<HistoryIcon aria-hidden />
						</Link>
					</Button>
				}
				description={t.units.workspace.sections.contentStructure.description}
				title={t.units.workspace.sections.contentStructure.label}
			/>
			<div className="grid gap-8">
				<ContentCreateForm
					baseRevisionId={baseRevisionId}
					bookId={bookId}
					create={create.mutateAsync}
					error={create.error}
					flatNodes={flattened}
					pending={create.isPending}
				/>
				<Card appearance="outlined">
					<CardContent className="p-0">
						{nodes.length ? (
							<ContentStructureEditorTree
								bookId={bookId}
								flatNodes={flattened}
								nodes={nodes}
								onMove={async (nodeId, parentId, position) => {
									await update.mutateAsync({
										path: { unitId: bookId, nodeId },
										body: {
											baseRevisionId,
											parentId,
											...(position ? { position } : {}),
										},
									});
								}}
								onRename={async (node, title) => {
									await update.mutateAsync({
										path: { unitId: bookId, nodeId: node.id },
										body: { title },
									});
								}}
								pending={update.isPending}
							/>
						) : (
							<p className="p-6 text-sm text-muted-foreground">
								{t.units.content.noContent}
							</p>
						)}
						<RequestFailure error={update.error} fallback={t.ui.retryLater} />
					</CardContent>
				</Card>
			</div>
		</section>
	);
}

function ContentCreateForm({
	baseRevisionId,
	bookId,
	flatNodes,
	create,
	error,
	pending,
}: {
	baseRevisionId: string;
	bookId: string;
	flatNodes: readonly FlattenedContentStructureTreeNode[];
	create: (variables: PostApiUnitsBookByUnitIdContentStructureNodesOptions) => Promise<unknown>;
	error: unknown;
	pending: boolean;
}) {
	const { t, locale } = useTranslation(["create", "engagement", "errors", "ui", "units"]);
	const [kind, setKind] = useState<"chapter" | "group">("chapter");
	const [content, setContent] = useState<PortableTextValue>([]);
	const [editorKey, setEditorKey] = useState(0);
	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const element = event.currentTarget;
		const form = new FormData(element);
		const parentId = String(form.get("parentId") ?? "");
		try {
			await create({
				path: { unitId: bookId },
				body: {
					baseRevisionId,
					title: String(form.get("title") ?? "").trim(),
					language: toContentLanguage(locale.target),
					...(parentId ? { parentId } : {}),
					...(kind === "chapter"
						? {
								content: writePortableText(content),
								status: form.get("status") === "draft" ? "draft" : "published",
							}
						: {}),
				},
			});
			element.reset();
			setContent([]);
			setEditorKey((current) => current + 1);
		} catch {
			// The typed mutation state supplies the visible API error.
		}
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
						{kind === "chapter" && (
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
						)}
						<Button variant="solid" isLoading={pending} type="submit">
							{kind === "chapter"
								? t.units.content.createChapter
								: t.units.content.createGroup}
						</Button>
						<RequestFailure error={error} fallback={t.ui.retryLater} />
					</FieldGroup>
				</form>
			</CardContent>
		</Card>
	);
}

function ContentStructureEditorTree({
	bookId,
	nodes,
	flatNodes,
	pending,
	onRename,
	onMove,
}: {
	bookId: string;
	nodes: readonly ContentStructureNode[];
	flatNodes: readonly FlattenedContentStructureTreeNode[];
	pending: boolean;
	onRename: (node: ContentStructureNode, title: string) => Promise<void>;
	onMove: (nodeId: string, parentId: string | null, position?: string) => Promise<void>;
}) {
	const { t } = useTranslation(["create", "engagement", "errors", "ui", "units"]);
	const [editing, setEditing] = useState<
		{ kind: "rename"; nodeId: string } | { kind: "move"; nodeId: string } | undefined
	>();
	const [draggingId, setDraggingId] = useState<string>();
	const [dropTargetId, setDropTargetId] = useState<string | null>();
	const editorNodes = useMemo(() => toEditorTreeNodes(buildContentStructureTree(nodes)), [nodes]);
	const rootNode: ContentStructureEditorNode = {
		children: editorNodes,
		id: "content-structure-root",
		name: "",
		node: null,
	};
	const collection = createTreeCollection<ContentStructureEditorNode>({ rootNode });
	const validDropTargets = draggingId
		? new Set(getContentStructureMoveTargets(nodes, draggingId).map((node) => node.id))
		: new Set<string>();
	const editingNode = editing
		? nodes.find((candidate) => candidate.id === editing.nodeId)
		: undefined;

	async function move(nodeId: string, parentId: string | null, position?: string) {
		try {
			await onMove(nodeId, parentId, position);
		} catch {
			// The mutation state supplies the visible request failure.
		}
	}

	async function drop(parentId: string | null) {
		const movingId = draggingId;
		if (!movingId || (parentId !== null && !validDropTargets.has(parentId))) return;
		try {
			await move(movingId, parentId);
		} finally {
			setDraggingId(undefined);
			setDropTargetId(undefined);
		}
	}

	async function reorder(nodeId: string, direction: "earlier" | "later") {
		const node = nodes.find((candidate) => candidate.id === nodeId);
		if (!node) return;
		const siblings = nodes
			.filter((candidate) => candidate.parentId === node.parentId)
			.toSorted((left, right) =>
				left.position < right.position ? -1 : left.position > right.position ? 1 : 0,
			);
		const index = siblings.findIndex((candidate) => candidate.id === nodeId);
		if (index < 0) return;
		const position =
			direction === "earlier"
				? generateKeyBetween(
						siblings[index - 2]?.position ?? null,
						siblings[index - 1]?.position ?? null,
					)
				: generateKeyBetween(
						siblings[index + 1]?.position ?? null,
						siblings[index + 2]?.position ?? null,
					);
		await move(nodeId, node.parentId, position);
	}

	async function changeDepth(nodeId: string, direction: "indent" | "outdent") {
		const target = getContentStructureDepthMove(nodes, nodeId, direction);
		if (target) await move(nodeId, target.parentId, target.position);
	}

	return (
		<div className="grid gap-4 p-4">
			{draggingId ? (
				<div
					className={cn(
						"rounded-lg border border-dashed px-4 py-3 text-center text-sm text-muted-foreground",
						dropTargetId === null && "border-primary bg-primary/5 text-foreground",
					)}
					onDragOver={(event) => {
						event.preventDefault();
						setDropTargetId(null);
					}}
					onDrop={(event) => {
						event.preventDefault();
						void drop(null);
					}}
				>
					{t.units.content.root}
				</div>
			) : null}
			<TreeEditor
				collection={collection}
				defaultExpandedValue={getExpandedEditorNodeIds(editorNodes)}
				label={t.units.content.title}
				renderNode={(node, indexPath) => (
					<ContentStructureEditorNodeRow
						allNodes={nodes}
						bookId={bookId}
						draggingId={draggingId}
						dropTargetId={dropTargetId}
						indexPath={indexPath}
						key={node.id}
						node={node}
						onDragEnd={() => {
							setDraggingId(undefined);
							setDropTargetId(undefined);
						}}
						onDragStart={setDraggingId}
						onDropTarget={(nodeId) => void drop(nodeId)}
						onMoveRequest={(nodeId) => setEditing({ kind: "move", nodeId })}
						onDepthRequest={(nodeId, direction) => void changeDepth(nodeId, direction)}
						onRenameRequest={(nodeId) => setEditing({ kind: "rename", nodeId })}
						onReorderRequest={(nodeId, direction) => void reorder(nodeId, direction)}
						onTargetChange={setDropTargetId}
						pending={pending}
						validDropTargets={validDropTargets}
					/>
				)}
			/>
			{editing && editingNode ? (
				<ContentStructureNodeEditor
					flatNodes={flatNodes}
					kind={editing.kind}
					node={editingNode}
					nodes={nodes}
					onCancel={() => setEditing(undefined)}
					onMove={onMove}
					onRename={onRename}
					pending={pending}
				/>
			) : null}
		</div>
	);
}

function compareContentPosition(left: ContentStructureNode, right: ContentStructureNode) {
	return left.position < right.position ? -1 : left.position > right.position ? 1 : 0;
}

interface ContentStructureEditorNode extends TreeNodeType {
	children?: ContentStructureEditorNode[];
	node: ContentStructureNode | null;
}

function toEditorTreeNodes(
	nodes: readonly ReturnType<typeof buildContentStructureTree>[number][],
): ContentStructureEditorNode[] {
	return nodes.map((entry) => ({
		...(entry.children.length ? { children: toEditorTreeNodes(entry.children) } : {}),
		id: entry.node.id,
		name: entry.node.title,
		node: entry.node,
	}));
}

function getExpandedEditorNodeIds(nodes: readonly ContentStructureEditorNode[]): string[] {
	return nodes.flatMap((node) =>
		node.children?.length ? [node.id, ...getExpandedEditorNodeIds(node.children)] : [],
	);
}

function ContentStructureEditorNodeRow({
	bookId,
	allNodes,
	node,
	indexPath,
	pending,
	draggingId,
	dropTargetId,
	validDropTargets,
	onDragStart,
	onDragEnd,
	onTargetChange,
	onDropTarget,
	onRenameRequest,
	onMoveRequest,
	onDepthRequest,
	onReorderRequest,
}: {
	bookId: string;
	allNodes: readonly ContentStructureNode[];
	node: ContentStructureEditorNode;
	indexPath: number[];
	pending: boolean;
	draggingId?: string;
	dropTargetId?: string | null;
	validDropTargets: ReadonlySet<string>;
	onDragStart: (nodeId: string) => void;
	onDragEnd: () => void;
	onTargetChange: (nodeId: string) => void;
	onDropTarget: (nodeId: string) => void;
	onRenameRequest: (nodeId: string) => void;
	onMoveRequest: (nodeId: string) => void;
	onDepthRequest: (nodeId: string, direction: "indent" | "outdent") => void;
	onReorderRequest: (nodeId: string, direction: "earlier" | "later") => void;
}) {
	const { t } = useTranslation(["create", "engagement", "errors", "ui", "units"]);
	if (!node.node) return null;
	const contentNode = node.node;
	const canDrop = validDropTargets.has(node.id);
	const siblings = allNodes
		.filter((candidate) => candidate.parentId === contentNode.parentId)
		.toSorted(compareContentPosition);
	const siblingIndex = siblings.findIndex((candidate) => candidate.id === contentNode.id);
	const rowClassName = cn(
		"pe-28",
		draggingId === node.id && "opacity-50",
		dropTargetId === node.id && canDrop && "bg-primary/10 outline-2 outline-primary",
	);
	const dragProps = {
		draggable: !pending,
		onDragStart: (event: React.DragEvent<HTMLElement>) => {
			event.dataTransfer.effectAllowed = "move";
			event.dataTransfer.setData("text/plain", node.id);
			onDragStart(node.id);
		},
		onDragEnd,
		onDragOver: (event: React.DragEvent<HTMLElement>) => {
			if (!canDrop) return;
			event.preventDefault();
			event.dataTransfer.dropEffect = "move";
			onTargetChange(node.id);
		},
		onDrop: (event: React.DragEvent<HTMLElement>) => {
			if (!canDrop) return;
			event.preventDefault();
			onDropTarget(node.id);
		},
	};
	const actions = (
		<div className="absolute end-2 top-1/2 z-2 flex -translate-y-1/2 items-center gap-1 rounded-md bg-background/90 opacity-100 backdrop-blur sm:opacity-0 sm:group-hover/editor-row:opacity-100 sm:group-focus-within/editor-row:opacity-100">
			<GripVertical aria-hidden className="mx-1 size-4 text-muted-foreground" />
			{contentNode.contentKind === "chapter" ? (
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
						onSelect={() => onReorderRequest(node.id, "earlier")}
						value="earlier"
					>
						<ArrowUp aria-hidden />
						{t.units.content.moveEarlier}
					</MenuItem>
					<MenuItem
						disabled={siblingIndex < 0 || siblingIndex >= siblings.length - 1}
						onSelect={() => onReorderRequest(node.id, "later")}
						value="later"
					>
						<ArrowDown aria-hidden />
						{t.units.content.moveLater}
					</MenuItem>
					<MenuItem
						disabled={siblingIndex <= 0}
						onSelect={() => onDepthRequest(node.id, "indent")}
						value="indent"
					>
						<IndentIncrease aria-hidden />
						{t.units.content.indent}
					</MenuItem>
					<MenuItem
						disabled={!contentNode.parentId}
						onSelect={() => onDepthRequest(node.id, "outdent")}
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
						{t.units.content.move}
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
							<ContentStructureEditorNodeRow
								allNodes={allNodes}
								bookId={bookId}
								draggingId={draggingId}
								dropTargetId={dropTargetId}
								indexPath={[...indexPath, index]}
								key={child.id}
								node={child}
								onDragEnd={onDragEnd}
								onDragStart={onDragStart}
								onDropTarget={onDropTarget}
								onMoveRequest={onMoveRequest}
								onDepthRequest={onDepthRequest}
								onRenameRequest={onRenameRequest}
								onReorderRequest={onReorderRequest}
								onTargetChange={onTargetChange}
								pending={pending}
								validDropTargets={validDropTargets}
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

function ContentStructureNodeEditor({
	node,
	nodes,
	flatNodes,
	kind,
	pending,
	onRename,
	onMove,
	onCancel,
}: {
	node: ContentStructureNode;
	nodes: readonly ContentStructureNode[];
	flatNodes: readonly FlattenedContentStructureTreeNode[];
	kind: "rename" | "move";
	pending: boolean;
	onRename: (node: ContentStructureNode, title: string) => Promise<void>;
	onMove: (nodeId: string, parentId: string | null, position?: string) => Promise<void>;
	onCancel: () => void;
}) {
	const { t } = useTranslation(["engagement", "ui", "units"]);
	const validTargets = new Set(
		getContentStructureMoveTargets(nodes, node.id).map((target) => target.id),
	);
	return (
		<Card appearance="outlined">
			<CardContent className="p-4">
				<form
					className="flex flex-wrap items-end gap-3"
					onSubmit={async (event) => {
						event.preventDefault();
						const form = new FormData(event.currentTarget);
						try {
							if (kind === "rename") {
								const title = String(form.get("title") ?? "").trim();
								if (!title) return;
								await onRename(node, title);
							} else {
								const parentId = String(form.get("parentId") ?? "") || null;
								await onMove(node.id, parentId);
							}
							onCancel();
						} catch {
							// The parent mutation renders the typed request failure.
						}
					}}
				>
					{kind === "rename" ? (
						<Field className="min-w-52 flex-1" required>
							<FieldLabel>{t.units.content.rename}</FieldLabel>
							<Input
								defaultValue={node.title}
								maxLength={500}
								name="title"
								required
							/>
						</Field>
					) : (
						<Field className="min-w-52 flex-1">
							<FieldLabel>{t.units.content.parent}</FieldLabel>
							<NativeSelect defaultValue={node.parentId ?? ""} name="parentId">
								<NativeSelectOption value="">
									{t.units.content.root}
								</NativeSelectOption>
								{flatNodes
									.filter(({ node: candidate }) => validTargets.has(candidate.id))
									.map(({ node: candidate, depth }) => (
										<NativeSelectOption key={candidate.id} value={candidate.id}>
											{"— ".repeat(depth)}
											{candidate.title}
										</NativeSelectOption>
									))}
							</NativeSelect>
						</Field>
					)}
					<Button isLoading={pending} size="sm" type="submit" variant="solid">
						{t.ui.save}
					</Button>
					<Button onClick={onCancel} size="sm" type="button" variant="quiet">
						{t.engagement.cancel}
					</Button>
				</form>
			</CardContent>
		</Card>
	);
}
