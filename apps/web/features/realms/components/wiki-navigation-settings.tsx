"use client";

import {
	NavigationDocument,
	createBlockKey,
	parseDocument,
	type NavigationDocument as NavigationDocumentValue,
} from "@rezics/block";
import {
	getApiRealmsByRealmIdWikiNavigationQueryKey,
	type GetApiRealmsByRealmIdWikiNavigationStatus200,
	useDeleteApiRealmsByRealmIdWikiNavigationByNavigationId,
	useGetApiRealmsByRealmIdWikiNavigation,
	usePostApiRealmsByRealmIdWikiNavigation,
	usePutApiRealmsByRealmIdWikiNavigationByNavigationId,
} from "@rezics/openapi-tanstack-query";
import {
	Badge,
	Button,
	Card,
	CardContent,
	cn,
	Dialog,
	DialogClose,
	DialogContent,
	DialogFooter,
	DialogHeader,
	Input,
	QueryFailure,
	QueryPending,
	UnitPicker,
	useUnitMentionResolver,
	type UnitMentionPresentation,
} from "@rezics/ui";
import { useQueryClient } from "@tanstack/react-query";
import {
	ArrowDown,
	ArrowLeftFromLine,
	ArrowRightToLine,
	ArrowUp,
	ChevronRight,
	FolderPlus,
	GripVertical,
	Link as LinkIcon,
	ListTree,
	Plus,
	Save,
	Search,
	Square,
	SquareCheckBig,
	Trash2,
	Undo2,
} from "lucide-react";
import {
	type DragEvent,
	type MouseEvent,
	type ReactNode,
	useEffect,
	useMemo,
	useState,
} from "react";

import {
	TreeEditorRowFrame,
	VirtualizedTreeRows,
} from "@/features/content-structure/components/virtualized-tree";
import {
	buildEditableTree,
	collectEditableTreeParentIds,
	editableTreeMoveTargetIds,
	editableTreeSearchVisibility,
	flattenVisibleEditableTree,
	moveEditableTreeSelection,
	removeEditableTreeNodes,
} from "@/features/content-structure/model/editable-tree";
import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import {
	createWikiNavigationDraft,
	createWikiNavigationDraftNode,
	toWikiNavigationDocument,
	updateWikiNavigationDraftNode,
	wikiNavigationDraftFingerprint,
	wikiNavigationDraftIsValid,
	wikiNavigationDraftTreeIsValid,
	type WikiNavigationDraftNode,
} from "../model/wiki-navigation-draft";

type WikiNavigation = GetApiRealmsByRealmIdWikiNavigationStatus200["items"][number];
type ActiveDrop = {
	readonly nodeId: string;
	readonly placement: "before" | "inside" | "after";
};

type NavigationEditorDocument = {
	readonly documentKey: string;
	readonly baseRevisionId?: string;
	readonly baseline: readonly WikiNavigationDraftNode[];
	readonly draft: readonly WikiNavigationDraftNode[];
};

const EmptyIds: ReadonlySet<string> = new Set();

function newNavigationDocument(): NavigationDocumentValue {
	return {
		_type: "navigation-document",
		_key: createBlockKey(),
		items: [
			{
				_key: createBlockKey(),
				labelUnitId: "",
				target: { kind: "unit", unitId: "" },
			},
		],
	};
}

function createEditorDocument(navigation?: WikiNavigation): NavigationEditorDocument {
	const document = navigation
		? parseDocument(NavigationDocument, navigation.document)
		: newNavigationDocument();
	const draft = createWikiNavigationDraft(document);
	return {
		documentKey: document._key,
		...(navigation ? { baseRevisionId: navigation.latestRevisionId } : {}),
		baseline: draft,
		draft,
	};
}

function siblingEntries(
	nodes: readonly WikiNavigationDraftNode[],
	parentId: string | null,
): readonly WikiNavigationDraftNode[] {
	return nodes
		.filter((node) => node.parentId === parentId)
		.toSorted((left, right) => left.order - right.order || left.id.localeCompare(right.id));
}

function useNavigationPresentations(
	nodes: readonly WikiNavigationDraftNode[],
): ReadonlyMap<string, UnitMentionPresentation> {
	const resolve = useUnitMentionResolver();
	const ids = useMemo(
		() => [
			...new Set(
				nodes.flatMap((node) => [
					...(node.labelUnitId ? [node.labelUnitId] : []),
					...(node.targetUnitId ? [node.targetUnitId] : []),
				]),
			),
		],
		[nodes],
	);
	const idsKey = ids.join("\u0000");
	const [presentations, setPresentations] = useState<
		ReadonlyMap<string, UnitMentionPresentation>
	>(new Map());
	useEffect(() => {
		if (!idsKey || !resolve) {
			setPresentations(new Map());
			return;
		}
		const request = new AbortController();
		void resolve(idsKey.split("\u0000"), request.signal).then(
			(items) => {
				if (!request.signal.aborted)
					setPresentations(new Map(items.map((item) => [item.id, item])));
			},
			() => {
				if (!request.signal.aborted) setPresentations(new Map());
			},
		);
		return () => request.abort();
	}, [idsKey, resolve]);
	return presentations;
}

export function WikiNavigationSettings({ realmId }: { readonly realmId: string }) {
	const { t } = useTranslation(["realms"]);
	const query = useGetApiRealmsByRealmIdWikiNavigation({ path: { realmId } });
	if (query.isPending) return <QueryPending />;
	if (query.isError || !query.data)
		return <QueryFailure error={query.error} retry={() => void query.refetch()} />;
	return (
		<WikiNavigationSettingsLoaded
			initialItems={query.data.items}
			realmId={realmId}
			refetch={() => query.refetch()}
			title={t.realms.wikiNavigationSettings.title}
		/>
	);
}

function WikiNavigationSettingsLoaded({
	initialItems,
	realmId,
	refetch,
	title,
}: {
	readonly initialItems: readonly WikiNavigation[];
	readonly realmId: string;
	readonly refetch: () => Promise<unknown>;
	readonly title: string;
}) {
	const { t } = useTranslation(["realms"]);
	const [selectedId, setSelectedId] = useState<string | "new">(initialItems[0]?.id ?? "new");
	const [items, setItems] = useState(initialItems);
	useEffect(() => setItems(initialItems), [initialItems]);
	const selected = items.find(({ id }) => id === selectedId);

	async function refresh(nextId?: string) {
		const result = await refetch();
		const data =
			typeof result === "object" && result && "data" in result
				? (result.data as GetApiRealmsByRealmIdWikiNavigationStatus200 | undefined)
				: undefined;
		if (data) setItems(data.items);
		if (nextId) setSelectedId(nextId);
	}

	return (
		<div className="grid gap-4">
			<div className="grid gap-1">
				<h2 className="font-heading font-bold text-xl">{title}</h2>
				<p className="max-w-3xl text-muted-foreground text-sm">
					{t.realms.wikiNavigationSettings.description}
				</p>
			</div>
			<div className="grid gap-5 lg:grid-cols-[14rem_minmax(0,1fr)]">
				<Card appearance="outlined">
					<CardContent className="grid content-start gap-2 p-4">
						<div className="flex items-center justify-between gap-2">
							<h3 className="font-semibold">
								{t.realms.wikiNavigationSettings.resources}
							</h3>
							<Button
								aria-label={t.realms.wikiNavigationSettings.new}
								onClick={() => setSelectedId("new")}
								size="icon-sm"
								type="button"
								variant="outline"
							>
								<Plus aria-hidden />
							</Button>
						</div>
						{items.length ? (
							items.map((item, index) => (
								<Button
									className="justify-start"
									key={item.id}
									onClick={() => setSelectedId(item.id)}
									type="button"
									variant={selectedId === item.id ? "secondary" : "quiet"}
								>
									<LinkIcon aria-hidden />
									{t.realms.wikiNavigationSettings.resourceName({
										number: index + 1,
									})}
								</Button>
							))
						) : (
							<p className="text-muted-foreground text-sm">
								{t.realms.wikiNavigationSettings.noResources}
							</p>
						)}
						<Button
							className="mt-2 justify-start"
							onClick={() => setSelectedId("new")}
							type="button"
							variant={selectedId === "new" ? "secondary" : "outline"}
						>
							<Plus aria-hidden />
							{t.realms.wikiNavigationSettings.new}
						</Button>
					</CardContent>
				</Card>
				<WikiNavigationTreeEditor
					key={selected?.id ?? "new"}
					navigation={selected}
					onRemoved={async () => {
						setSelectedId("new");
						await refresh();
					}}
					onSaved={(navigationId) => void refresh(navigationId)}
					realmId={realmId}
				/>
			</div>
		</div>
	);
}

function WikiNavigationTreeEditor({
	navigation,
	onRemoved,
	onSaved,
	realmId,
}: {
	readonly navigation?: WikiNavigation;
	readonly onRemoved: () => Promise<void>;
	readonly onSaved: (navigationId: string) => void;
	readonly realmId: string;
}) {
	const { t } = useTranslation(["realms"]);
	const queryClient = useQueryClient();
	const [document, setDocument] = useState<NavigationEditorDocument>(() =>
		createEditorDocument(navigation),
	);
	const [expandedIds, setExpandedIds] = useState<ReadonlySet<string>>(() =>
		collectEditableTreeParentIds(document.draft),
	);
	const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(EmptyIds);
	const [lastSelectedId, setLastSelectedId] = useState<string>();
	const [query, setQuery] = useState("");
	const [draggingIds, setDraggingIds] = useState<ReadonlySet<string>>(EmptyIds);
	const [dropTarget, setDropTarget] = useState<ActiveDrop>();
	const [confirmRemove, setConfirmRemove] = useState(false);
	const create = usePostApiRealmsByRealmIdWikiNavigation();
	const update = usePutApiRealmsByRealmIdWikiNavigationByNavigationId();
	const remove = useDeleteApiRealmsByRealmIdWikiNavigationByNavigationId();
	const presentations = useNavigationPresentations(document.draft);
	const tree = useMemo(() => buildEditableTree(document.draft), [document.draft]);
	const search = useMemo(
		() =>
			editableTreeSearchVisibility(document.draft, query, (node) => {
				const label = presentations.get(node.labelUnitId)?.label ?? "";
				const target = node.targetUnitId
					? (presentations.get(node.targetUnitId)?.label ?? "")
					: "";
				return `${label} ${target} ${node.labelUnitId} ${node.targetUnitId ?? ""}`;
			}),
		[document.draft, presentations, query],
	);
	const effectiveExpandedIds = useMemo(
		() => new Set([...expandedIds, ...search.ancestorIds]),
		[expandedIds, search.ancestorIds],
	);
	const visibleEntries = useMemo(
		() => flattenVisibleEditableTree(tree, effectiveExpandedIds, search.visibleIds),
		[effectiveExpandedIds, search.visibleIds, tree],
	);
	const validDropTargetIds = useMemo(
		() => editableTreeMoveTargetIds(document.draft, selectedIds),
		[document.draft, selectedIds],
	);
	const baselineFingerprint = useMemo(
		() => wikiNavigationDraftFingerprint(document.baseline, document.documentKey),
		[document.baseline, document.documentKey],
	);
	const draftFingerprint = useMemo(
		() => wikiNavigationDraftFingerprint(document.draft, document.documentKey),
		[document.documentKey, document.draft],
	);
	const dirty = baselineFingerprint !== draftFingerprint;
	const valid = wikiNavigationDraftIsValid(document.draft);
	const selectedNode =
		selectedIds.size === 1 ? document.draft.find(({ id }) => selectedIds.has(id)) : undefined;
	const pending = create.isPending || update.isPending || remove.isPending;

	function changeDraft(
		change: (nodes: readonly WikiNavigationDraftNode[]) => WikiNavigationDraftNode[],
	) {
		setDocument((current) => ({ ...current, draft: change(current.draft) }));
	}

	function activateNode(
		nodeId: string,
		modifiers: {
			readonly ctrlKey: boolean;
			readonly metaKey: boolean;
			readonly shiftKey: boolean;
		},
	) {
		const visibleIds = visibleEntries.map(({ entry }) => entry.node.id);
		if (modifiers.shiftKey && lastSelectedId) {
			const start = visibleIds.indexOf(lastSelectedId);
			const end = visibleIds.indexOf(nodeId);
			if (start >= 0 && end >= 0) {
				setSelectedIds(
					new Set(visibleIds.slice(Math.min(start, end), Math.max(start, end) + 1)),
				);
				return;
			}
		}
		if (modifiers.ctrlKey || modifiers.metaKey) {
			setSelectedIds((current) => {
				const next = new Set(current);
				if (next.has(nodeId)) next.delete(nodeId);
				else next.add(nodeId);
				return next;
			});
		} else setSelectedIds(new Set([nodeId]));
		setLastSelectedId(nodeId);
	}

	function addNode(kind: "group" | "link", parentId: string | null = null) {
		const siblings = siblingEntries(document.draft, parentId);
		const node = createWikiNavigationDraftNode({
			id: createBlockKey(),
			parentId,
			order: siblings.length,
			kind,
		});
		const child =
			kind === "group"
				? createWikiNavigationDraftNode({
						id: createBlockKey(),
						parentId: node.id,
						order: 0,
						kind: "link",
					})
				: undefined;
		const next = [...document.draft, node, ...(child ? [child] : [])];
		if (!wikiNavigationDraftTreeIsValid(next)) return;
		changeDraft(() => next);
		setSelectedIds(new Set([node.id]));
		if (kind === "group") setExpandedIds((current) => new Set([...current, node.id]));
	}

	function applyMove(
		selection: ReadonlySet<string>,
		target: {
			readonly kind: "node";
			readonly nodeId: string;
			readonly placement: "before" | "inside" | "after";
		},
	) {
		const next = moveEditableTreeSelection(
			document.draft,
			selection,
			target,
			(node) => node.kind === "group",
		);
		if (!wikiNavigationDraftTreeIsValid(next)) return;
		changeDraft(() => next);
		if (target.placement === "inside")
			setExpandedIds((current) => new Set([...current, target.nodeId]));
	}

	function moveNode(nodeId: string, action: "up" | "down" | "indent" | "outdent") {
		const node = document.draft.find(({ id }) => id === nodeId);
		if (!node) return;
		const siblings = siblingEntries(document.draft, node.parentId);
		const index = siblings.findIndex(({ id }) => id === nodeId);
		let target:
			| {
					readonly kind: "node";
					readonly nodeId: string;
					readonly placement: "before" | "inside" | "after";
			  }
			| undefined;
		if (action === "up" && index > 0)
			target = { kind: "node", nodeId: siblings[index - 1]!.id, placement: "before" };
		if (action === "down" && index < siblings.length - 1)
			target = { kind: "node", nodeId: siblings[index + 1]!.id, placement: "after" };
		if (action === "indent" && index > 0 && siblings[index - 1]?.kind === "group")
			target = { kind: "node", nodeId: siblings[index - 1]!.id, placement: "inside" };
		if (action === "outdent" && node.parentId)
			target = { kind: "node", nodeId: node.parentId, placement: "after" };
		if (target) applyMove(new Set([nodeId]), target);
	}

	function handleDragOver(event: DragEvent<HTMLElement>, node: WikiNavigationDraftNode) {
		if (!validDropTargetIds.has(node.id)) return;
		const bounds = event.currentTarget.getBoundingClientRect();
		const ratio = (event.clientY - bounds.top) / Math.max(bounds.height, 1);
		const placement = ratio < 0.28 ? "before" : ratio > 0.72 ? "after" : "inside";
		if (placement === "inside" && node.kind !== "group") return;
		event.preventDefault();
		setDropTarget({ nodeId: node.id, placement });
	}

	async function saveDocument() {
		if (!dirty || !valid || pending) return;
		const nextDocument = toWikiNavigationDocument(document.draft, document.documentKey);
		try {
			const saved = navigation
				? await update.mutateAsync({
						path: { realmId, navigationId: navigation.id },
						body: {
							document: nextDocument,
							baseRevisionId: document.baseRevisionId!,
						},
					})
				: await create.mutateAsync({
						path: { realmId },
						body: { document: nextDocument },
					});
			const parsed = parseDocument(NavigationDocument, saved.document);
			const next = createWikiNavigationDraft(parsed);
			setDocument({
				documentKey: parsed._key,
				baseRevisionId: saved.latestRevisionId,
				baseline: next,
				draft: next,
			});
			await queryClient.invalidateQueries({
				queryKey: getApiRealmsByRealmIdWikiNavigationQueryKey({
					path: { realmId },
				}),
			});
			onSaved(saved.id);
		} catch {
			// Preserve the draft; the typed request failure is rendered below.
		}
	}

	async function removeNavigation() {
		if (!navigation || !document.baseRevisionId || remove.isPending) return;
		try {
			await remove.mutateAsync({
				path: { realmId, navigationId: navigation.id },
				body: { baseRevisionId: document.baseRevisionId },
			});
			await queryClient.invalidateQueries({
				queryKey: getApiRealmsByRealmIdWikiNavigationQueryKey({
					path: { realmId },
				}),
			});
			await onRemoved();
		} catch {
			// The typed request failure is rendered below.
		}
	}

	return (
		<Card appearance="outlined">
			<CardContent className="grid gap-4 p-5">
				<div className="flex flex-wrap items-start justify-between gap-3">
					<div>
						<h3 className="font-heading font-semibold text-lg">
							{navigation
								? t.realms.wikiNavigationSettings.edit
								: t.realms.wikiNavigationSettings.new}
						</h3>
						<div className="mt-1 flex items-center gap-2 text-muted-foreground text-sm">
							<span>{t.realms.wikiNavigationSettings.draftHint}</span>
							{dirty ? (
								<Badge variant="warning">
									{t.realms.wikiNavigationSettings.unsavedDraft}
								</Badge>
							) : null}
							{dirty && !valid ? (
								<Badge variant="destructive">
									{t.realms.wikiNavigationSettings.invalidDraft}
								</Badge>
							) : null}
						</div>
					</div>
					<div className="flex flex-wrap gap-2">
						<Button
							disabled={!dirty || pending}
							onClick={() =>
								setDocument((current) => ({
									...current,
									draft: current.baseline,
								}))
							}
							type="button"
							variant="outline"
						>
							<Undo2 aria-hidden />
							{t.realms.wikiNavigationSettings.discardDraft}
						</Button>
						<Button
							disabled={!dirty || !valid || pending}
							isLoading={create.isPending || update.isPending}
							onClick={() => void saveDocument()}
							type="button"
							variant="solid"
						>
							<Save aria-hidden />
							{t.realms.wikiNavigationSettings.saveDraft}
						</Button>
						{navigation ? (
							<Button
								aria-label={t.realms.wikiNavigationSettings.remove}
								onClick={() => setConfirmRemove(true)}
								size="icon-md"
								type="button"
								variant="outline"
							>
								<Trash2 aria-hidden />
							</Button>
						) : null}
					</div>
				</div>
				<div className="flex flex-wrap items-center gap-2">
					<div className="relative min-w-52 flex-1">
						<Search
							aria-hidden
							className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
						/>
						<Input
							aria-label={t.realms.wikiNavigationSettings.search}
							className="ps-9"
							onChange={(event) => setQuery(event.currentTarget.value)}
							placeholder={t.realms.wikiNavigationSettings.searchPlaceholder}
							type="search"
							value={query}
						/>
					</div>
					<Button onClick={() => addNode("link")} type="button" variant="outline">
						<LinkIcon aria-hidden />
						{t.realms.wikiNavigationSettings.addLink}
					</Button>
					<Button onClick={() => addNode("group")} type="button" variant="outline">
						<FolderPlus aria-hidden />
						{t.realms.wikiNavigationSettings.addGroup}
					</Button>
					{selectedIds.size ? (
						<Button
							onClick={() => {
								changeDraft((nodes) =>
									removeEditableTreeNodes(nodes, selectedIds, "subtree"),
								);
								setSelectedIds(EmptyIds);
							}}
							type="button"
							variant="outline"
						>
							<Trash2 aria-hidden />
							{t.realms.wikiNavigationSettings.removeItem}
						</Button>
					) : null}
				</div>
				<div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
					<div className="overflow-clip rounded-xl border border-border-weak">
						{visibleEntries.length ? (
							<VirtualizedTreeRows
								ariaMultiselectable
								entries={visibleEntries}
								label={t.realms.wikiNavigationSettings.treeLabel}
								pinnedNodeIds={draggingIds}
								renderRow={(visible) => {
									const { entry, depth, positionInSet, setSize } = visible;
									const node = entry.node;
									const selected = selectedIds.has(node.id);
									const expanded = effectiveExpandedIds.has(node.id);
									const label =
										presentations.get(node.labelUnitId)?.label ||
										t.realms.wikiNavigationSettings.unsetLabel;
									const target = node.targetUnitId
										? presentations.get(node.targetUnitId)?.label
										: undefined;
									return (
										<TreeEditorRowFrame
											activePlacement={
												dropTarget?.nodeId === node.id
													? dropTarget.placement
													: undefined
											}
											aria-expanded={
												node.kind === "group" ? expanded : undefined
											}
											aria-level={depth + 1}
											aria-posinset={positionInSet}
											aria-selected={selected}
											aria-setsize={setSize}
											depth={depth}
											dragging={draggingIds.has(node.id)}
											onClick={(event: MouseEvent<HTMLDivElement>) =>
												activateNode(node.id, event)
											}
											onDragOver={(event) => handleDragOver(event, node)}
											onDrop={(event) => {
												event.preventDefault();
												if (dropTarget)
													applyMove(selectedIds, {
														kind: "node",
														nodeId: dropTarget.nodeId,
														placement: dropTarget.placement,
													});
												setDraggingIds(EmptyIds);
												setDropTarget(undefined);
											}}
											role="treeitem"
											selected={selected}
										>
											<Button
												aria-label={
													selected
														? t.realms.wikiNavigationSettings.deselect
														: t.realms.wikiNavigationSettings.select
												}
												onClick={(event) => {
													event.stopPropagation();
													activateNode(node.id, event);
												}}
												size="icon-sm"
												type="button"
												variant="quiet"
											>
												{selected ? (
													<SquareCheckBig aria-hidden />
												) : (
													<Square aria-hidden />
												)}
											</Button>
											<button
												aria-label={t.realms.wikiNavigationSettings.move}
												className="cursor-grab touch-none text-muted-foreground active:cursor-grabbing"
												draggable
												onClick={(event) => event.stopPropagation()}
												onDragEnd={() => {
													setDraggingIds(EmptyIds);
													setDropTarget(undefined);
												}}
												onDragStart={(event) => {
													event.dataTransfer.effectAllowed = "move";
													const selection = selected
														? selectedIds
														: new Set([node.id]);
													setSelectedIds(selection);
													setDraggingIds(selection);
												}}
												type="button"
											>
												<GripVertical aria-hidden className="size-5" />
											</button>
											{node.kind === "group" ? (
												<Button
													aria-label={
														expanded
															? t.realms.wikiNavigationSettings
																	.collapse
															: t.realms.wikiNavigationSettings.expand
													}
													onClick={(event) => {
														event.stopPropagation();
														setExpandedIds((current) => {
															const next = new Set(current);
															if (next.has(node.id))
																next.delete(node.id);
															else next.add(node.id);
															return next;
														});
													}}
													size="icon-sm"
													type="button"
													variant="quiet"
												>
													<ChevronRight
														aria-hidden
														className={cn(
															"transition-transform",
															expanded && "rotate-90",
														)}
													/>
												</Button>
											) : (
												<span aria-hidden className="size-8" />
											)}
											<div className="min-w-0 flex-1">
												<div className="flex min-w-0 items-center gap-2">
													<span className="truncate font-semibold">
														{label}
													</span>
													<Badge variant="outline">
														{
															t.realms.wikiNavigationSettings
																.itemKinds[node.kind]
														}
													</Badge>
												</div>
												{node.kind === "link" ? (
													<p className="mt-1 truncate text-muted-foreground text-xs">
														{target ||
															t.realms.wikiNavigationSettings
																.unsetTarget}
													</p>
												) : null}
											</div>
											<div className="hidden items-center gap-1 lg:flex">
												<TreeAction
													label={t.realms.wikiNavigationSettings.moveUp}
													onClick={() => moveNode(node.id, "up")}
												>
													<ArrowUp aria-hidden />
												</TreeAction>
												<TreeAction
													label={t.realms.wikiNavigationSettings.moveDown}
													onClick={() => moveNode(node.id, "down")}
												>
													<ArrowDown aria-hidden />
												</TreeAction>
												<TreeAction
													label={t.realms.wikiNavigationSettings.indent}
													onClick={() => moveNode(node.id, "indent")}
												>
													<ArrowRightToLine aria-hidden />
												</TreeAction>
												<TreeAction
													label={t.realms.wikiNavigationSettings.outdent}
													onClick={() => moveNode(node.id, "outdent")}
												>
													<ArrowLeftFromLine aria-hidden />
												</TreeAction>
											</div>
										</TreeEditorRowFrame>
									);
								}}
							/>
						) : (
							<div className="grid min-h-64 place-items-center p-8 text-center">
								<div>
									<ListTree
										aria-hidden
										className="mx-auto size-8 text-muted-foreground"
									/>
									<p className="mt-3 text-muted-foreground text-sm">
										{document.draft.length
											? t.realms.wikiNavigationSettings.emptySearch
											: t.realms.wikiNavigationSettings.empty}
									</p>
								</div>
							</div>
						)}
					</div>
					<Card appearance="outlined">
						<CardContent className="grid content-start gap-4 p-4">
							<h4 className="font-semibold">
								{t.realms.wikiNavigationSettings.itemSettings}
							</h4>
							{selectedNode ? (
								<>
									<div className="grid gap-2">
										<label className="font-medium text-sm">
											{t.realms.wikiNavigationSettings.label}
										</label>
										<UnitPicker
											index="units"
											kinds={["label"]}
											onValueChange={(value) =>
												changeDraft((nodes) =>
													updateWikiNavigationDraftNode(
														nodes,
														selectedNode.id,
														{ labelUnitId: value ?? "" },
													),
												)
											}
											value={selectedNode.labelUnitId || undefined}
										/>
										<p className="text-muted-foreground text-xs">
											{t.realms.wikiNavigationSettings.labelHint}
										</p>
									</div>
									{selectedNode.kind === "link" ? (
										<div className="grid gap-2">
											<label className="font-medium text-sm">
												{t.realms.wikiNavigationSettings.target}
											</label>
											<UnitPicker
												index="posts"
												kinds={["post"]}
												onValueChange={(value) =>
													changeDraft((nodes) =>
														updateWikiNavigationDraftNode(
															nodes,
															selectedNode.id,
															{ targetUnitId: value ?? "" },
														),
													)
												}
												value={selectedNode.targetUnitId || undefined}
											/>
											<p className="text-muted-foreground text-xs">
												{t.realms.wikiNavigationSettings.targetHint}
											</p>
										</div>
									) : (
										<Button
											onClick={() => addNode("link", selectedNode.id)}
											type="button"
											variant="outline"
										>
											<Plus aria-hidden />
											{t.realms.wikiNavigationSettings.addChild}
										</Button>
									)}
								</>
							) : (
								<p className="text-muted-foreground text-sm">
									{t.realms.wikiNavigationSettings.selectHint}
								</p>
							)}
						</CardContent>
					</Card>
				</div>
				<RequestFailure error={create.error ?? update.error ?? remove.error} />
				{confirmRemove ? (
					<Dialog onOpenChange={({ open }) => !open && setConfirmRemove(false)} open>
						<DialogContent>
							<DialogHeader
								description={t.realms.wikiNavigationSettings.removeDescription}
								title={t.realms.wikiNavigationSettings.removeTitle}
							/>
							<DialogFooter>
								<DialogClose asChild>
									<Button type="button" variant="quiet">
										{t.realms.wikiNavigationSettings.cancel}
									</Button>
								</DialogClose>
								<Button
									isLoading={remove.isPending}
									onClick={() => void removeNavigation()}
									type="button"
									variant="destructive"
								>
									{t.realms.wikiNavigationSettings.remove}
								</Button>
							</DialogFooter>
						</DialogContent>
					</Dialog>
				) : null}
			</CardContent>
		</Card>
	);
}

function TreeAction({
	children,
	label,
	onClick,
}: {
	readonly children: ReactNode;
	readonly label: string;
	readonly onClick: () => void;
}) {
	return (
		<Button
			aria-label={label}
			onClick={(event) => {
				event.stopPropagation();
				onClick();
			}}
			size="icon-sm"
			type="button"
			variant="quiet"
		>
			{children}
		</Button>
	);
}
