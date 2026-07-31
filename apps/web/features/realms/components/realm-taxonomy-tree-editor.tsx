"use client";

import { toContentLanguage } from "@rezics/i18n";
import {
	getApiRealmsByRealmIdTaxonomyQueryKey,
	useGetApiRealmsByRealmIdTaxonomyDraft,
	usePutApiRealmsByRealmIdTaxonomyDraft,
} from "@rezics/openapi-tanstack-query";
import {
	Badge,
	Button,
	cn,
	Dialog,
	DialogBody,
	DialogClose,
	DialogContent,
	DialogFooter,
	DialogHeader,
	EntityPicker,
	type EntityPickerValue,
	Field,
	FieldLabel,
	IdentityAvatar,
	Input,
	NativeSelect,
	NativeSelectOption,
	QueryFailure,
	QueryPending,
} from "@rezics/ui";
import { useQueryClient } from "@tanstack/react-query";
import {
	ArrowDown,
	ArrowLeftFromLine,
	ArrowRightToLine,
	ArrowUp,
	ChevronRight,
	FileText,
	FolderPlus,
	GripVertical,
	Plus,
	Save,
	Search,
	Square,
	SquareCheckBig,
	Tag,
	Trash2,
	Undo2,
} from "lucide-react";
import { type DragEvent, type MouseEvent, useEffect, useMemo, useState } from "react";

import {
	TreeEditorRowFrame,
	VirtualizedTreeRows,
} from "@/features/content-structure/components/virtualized-tree";
import {
	buildEditableTree,
	collectEditableTreeParentIds,
	editableTreeMoveTargetIds,
	editableTreeSearchVisibility,
	editableTreeSelectionCoverage,
	flattenVisibleEditableTree,
	moveEditableTreeSelection,
	removeEditableTreeNodes,
} from "@/features/content-structure/model/editable-tree";
import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import { useLocalizationLanguages } from "@/i18n/use-localization-languages";
import {
	createRealmTaxonomyDraft,
	createRealmTaxonomyLabel,
	createRealmTaxonomyUnit,
	realmTaxonomyDraftFingerprint,
	realmTaxonomyDraftIsValid,
	RealmTaxonomyQueryStrategies,
	type RealmTaxonomyDraftNode,
	type RealmTaxonomyQueryStrategy,
	renameRealmTaxonomyLabel,
	toRealmTaxonomySaveNodes,
} from "../model/realm-taxonomy-draft";

type TaxonomyDocument = {
	readonly baseRevisionId: string;
	readonly baseline: readonly RealmTaxonomyDraftNode[];
	readonly draft: readonly RealmTaxonomyDraftNode[];
};

type AddRequest = "label" | "tag" | "wiki";
type DropPlacement = "before" | "inside" | "after";
type ActiveDrop = { readonly nodeId: string; readonly placement: DropPlacement };

const EmptyIds: ReadonlySet<string> = new Set();

function isQueryStrategy(value: string): value is RealmTaxonomyQueryStrategy {
	return RealmTaxonomyQueryStrategies.some((candidate) => candidate === value);
}

function siblingEntries(
	nodes: readonly RealmTaxonomyDraftNode[],
	parentId: string | null,
): readonly RealmTaxonomyDraftNode[] {
	return nodes
		.filter((node) => node.parentId === parentId)
		.toSorted((left, right) => left.order - right.order || left.id.localeCompare(right.id));
}

function placementForNewNode(
	nodes: readonly RealmTaxonomyDraftNode[],
	selectedIds: ReadonlySet<string>,
): { readonly parentId: string | null; readonly order: number } {
	const selectedId = selectedIds.size === 1 ? [...selectedIds][0] : undefined;
	const parentId = selectedId && nodes.some(({ id }) => id === selectedId) ? selectedId : null;
	return { parentId, order: siblingEntries(nodes, parentId).length };
}

export function RealmTaxonomySettings({ realmId }: { readonly realmId: string }) {
	const { t, locale } = useTranslation(["realms", "tags", "ui"]);
	const queryClient = useQueryClient();
	const localizationLanguages = useLocalizationLanguages();
	const taxonomy = useGetApiRealmsByRealmIdTaxonomyDraft({
		path: { realmId },
		query: { localizationLanguages },
	});
	const save = usePutApiRealmsByRealmIdTaxonomyDraft();
	const [document, setDocument] = useState<TaxonomyDocument>();
	const [expandedIds, setExpandedIds] = useState<ReadonlySet<string>>(EmptyIds);
	const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(EmptyIds);
	const [lastSelectedId, setLastSelectedId] = useState<string>();
	const [query, setQuery] = useState("");
	const [addRequest, setAddRequest] = useState<AddRequest>();
	const [removeRequest, setRemoveRequest] = useState<ReadonlySet<string>>();
	const [draggingIds, setDraggingIds] = useState<ReadonlySet<string>>(EmptyIds);
	const [dropTarget, setDropTarget] = useState<ActiveDrop>();

	useEffect(() => {
		if (!taxonomy.data) return;
		const draft = createRealmTaxonomyDraft(taxonomy.data);
		setDocument({
			baseRevisionId: taxonomy.data.latestRevisionId,
			baseline: draft,
			draft,
		});
		setExpandedIds(collectEditableTreeParentIds(draft));
		setSelectedIds(EmptyIds);
	}, [taxonomy.data]);

	const tree = useMemo(() => buildEditableTree(document?.draft ?? []), [document?.draft]);
	const search = useMemo(
		() =>
			editableTreeSearchVisibility(
				document?.draft ?? [],
				query,
				(node) =>
					`${node.title} ${node.summary ?? ""} ${
						node.state === "new-label" ? "" : node.contentUnitId
					}`,
			),
		[document?.draft, query],
	);
	const effectiveExpandedIds = useMemo(
		() => new Set([...expandedIds, ...search.ancestorIds]),
		[expandedIds, search.ancestorIds],
	);
	const visibleEntries = useMemo(
		() => flattenVisibleEditableTree(tree, effectiveExpandedIds, search.visibleIds),
		[effectiveExpandedIds, search.visibleIds, tree],
	);
	const parentIds = useMemo(
		() => collectEditableTreeParentIds(document?.draft ?? []),
		[document?.draft],
	);
	const selectedCoverage = useMemo(
		() => editableTreeSelectionCoverage(document?.draft ?? [], selectedIds),
		[document?.draft, selectedIds],
	);
	const validDropTargetIds = useMemo(
		() => editableTreeMoveTargetIds(document?.draft ?? [], selectedIds),
		[document?.draft, selectedIds],
	);
	const draftFingerprint = useMemo(
		() => realmTaxonomyDraftFingerprint(document?.draft ?? []),
		[document?.draft],
	);
	const baselineFingerprint = useMemo(
		() => realmTaxonomyDraftFingerprint(document?.baseline ?? []),
		[document?.baseline],
	);
	const dirty = draftFingerprint !== baselineFingerprint;
	const valid = realmTaxonomyDraftIsValid(document?.draft ?? []);
	const selectedTagNodes =
		document?.draft.filter(
			(node) => selectedCoverage.has(node.id) && node.contentKind === "tag",
		) ?? [];

	function changeDraft(
		change: (nodes: readonly RealmTaxonomyDraftNode[]) => RealmTaxonomyDraftNode[],
	) {
		setDocument((current) =>
			current ? { ...current, draft: change(current.draft) } : current,
		);
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
				const range = visibleIds.slice(Math.min(start, end), Math.max(start, end) + 1);
				setSelectedIds((current) => new Set([...current, ...range]));
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
		} else {
			setSelectedIds(new Set([nodeId]));
		}
		setLastSelectedId(nodeId);
	}

	function moveNode(nodeId: string, action: "up" | "down" | "indent" | "outdent") {
		if (!document) return;
		const node = document.draft.find(({ id }) => id === nodeId);
		if (!node) return;
		const siblings = siblingEntries(document.draft, node.parentId);
		const index = siblings.findIndex(({ id }) => id === nodeId);
		let target:
			| { readonly kind: "node"; readonly nodeId: string; readonly placement: DropPlacement }
			| undefined;
		if (action === "up" && index > 0)
			target = { kind: "node", nodeId: siblings[index - 1]!.id, placement: "before" };
		if (action === "down" && index >= 0 && index < siblings.length - 1)
			target = { kind: "node", nodeId: siblings[index + 1]!.id, placement: "after" };
		if (action === "indent" && index > 0)
			target = { kind: "node", nodeId: siblings[index - 1]!.id, placement: "inside" };
		if (action === "outdent" && node.parentId)
			target = { kind: "node", nodeId: node.parentId, placement: "after" };
		if (!target) return;
		changeDraft((nodes) => moveEditableTreeSelection(nodes, new Set([nodeId]), target));
		if (target.placement === "inside")
			setExpandedIds((current) => new Set([...current, target.nodeId]));
	}

	function beginDrag(nodeId: string) {
		const nextSelection = selectedCoverage.has(nodeId) ? selectedIds : new Set([nodeId]);
		setSelectedIds(nextSelection);
		if (document)
			setDraggingIds(
				new Set(editableTreeSelectionCoverage(document.draft, nextSelection).keys()),
			);
	}

	function handleDragOver(event: DragEvent<HTMLElement>, nodeId: string) {
		if (!validDropTargetIds.has(nodeId)) return;
		event.preventDefault();
		const bounds = event.currentTarget.getBoundingClientRect();
		const ratio = (event.clientY - bounds.top) / Math.max(bounds.height, 1);
		const placement: DropPlacement =
			ratio < 0.28 ? "before" : ratio > 0.72 ? "after" : "inside";
		setDropTarget({ nodeId, placement });
	}

	function completeDrop() {
		if (!dropTarget || !selectedIds.size) return;
		changeDraft((nodes) =>
			moveEditableTreeSelection(nodes, selectedIds, {
				kind: "node",
				nodeId: dropTarget.nodeId,
				placement: dropTarget.placement,
			}),
		);
		if (dropTarget.placement === "inside")
			setExpandedIds((current) => new Set([...current, dropTarget.nodeId]));
		setDropTarget(undefined);
		setDraggingIds(EmptyIds);
	}

	function addNode(request: AddRequest, value: string | EntityPickerValue) {
		if (!document) return;
		const placement = placementForNewNode(document.draft, selectedIds);
		const language = toContentLanguage(locale.target);
		const node =
			request === "label"
				? createRealmTaxonomyLabel({
						id: crypto.randomUUID(),
						language,
						...placement,
						title: typeof value === "string" ? value : value.label,
					})
				: createRealmTaxonomyUnit({
						id: crypto.randomUUID(),
						language,
						...placement,
						presentation:
							typeof value === "string" ? { id: value, label: value } : value,
						contentKind: request,
					});
		changeDraft((nodes) => [...nodes, node]);
		if (placement.parentId)
			setExpandedIds((current) => new Set([...current, placement.parentId!]));
		setSelectedIds(new Set([node.id]));
		setLastSelectedId(node.id);
		setAddRequest(undefined);
	}

	function removeNodes(mode: "promote-children" | "subtree") {
		if (!removeRequest) return;
		changeDraft((nodes) => removeEditableTreeNodes(nodes, removeRequest, mode));
		setSelectedIds(EmptyIds);
		setRemoveRequest(undefined);
	}

	function applyStrategy(strategy: RealmTaxonomyQueryStrategy) {
		changeDraft((nodes) =>
			nodes.map((node) =>
				selectedCoverage.has(node.id) && node.contentKind === "tag"
					? { ...node, queryStrategy: strategy }
					: node,
			),
		);
	}

	async function saveDraft() {
		if (!document || !dirty || !valid || save.isPending) return;
		try {
			const saved = await save.mutateAsync({
				path: { realmId },
				body: {
					baseRevisionId: document.baseRevisionId,
					nodes: toRealmTaxonomySaveNodes(document.draft),
				},
			});
			const next = createRealmTaxonomyDraft(saved);
			setDocument({
				baseRevisionId: saved.latestRevisionId,
				baseline: next,
				draft: next,
			});
			setExpandedIds(collectEditableTreeParentIds(next));
			await queryClient.invalidateQueries({
				queryKey: getApiRealmsByRealmIdTaxonomyQueryKey({
					path: { realmId },
					query: { localizationLanguages },
				}),
			});
		} catch {
			// Preserve the local draft; the typed mutation error is rendered below.
		}
	}

	if (taxonomy.isPending || !document) return <QueryPending />;
	if (taxonomy.isError)
		return <QueryFailure error={taxonomy.error} retry={() => void taxonomy.refetch()} />;

	return (
		<div className="grid gap-4">
			<div className="flex flex-wrap items-start justify-between gap-4">
				<div className="grid gap-1">
					<h2 className="font-heading font-bold text-xl">
						{t.realms.taxonomySettings.title}
					</h2>
					<p className="max-w-3xl text-muted-foreground text-sm">
						{t.realms.taxonomySettings.description}
					</p>
				</div>
				<div className="flex flex-wrap gap-2">
					<Button
						disabled={!dirty || save.isPending}
						onClick={() =>
							setDocument((current) =>
								current ? { ...current, draft: current.baseline } : current,
							)
						}
						type="button"
						variant="outline"
					>
						<Undo2 aria-hidden />
						{t.realms.taxonomySettings.discardDraft}
					</Button>
					<Button
						disabled={!dirty || !valid || save.isPending}
						isLoading={save.isPending}
						onClick={() => void saveDraft()}
						type="button"
						variant="solid"
					>
						<Save aria-hidden />
						{t.realms.taxonomySettings.saveDraft}
					</Button>
				</div>
			</div>
			<div className="flex min-h-6 items-center gap-2">
				<p className="text-muted-foreground text-sm">
					{t.realms.taxonomySettings.draftHint}
				</p>
				{dirty ? (
					<Badge variant="warning">{t.realms.taxonomySettings.unsavedDraft}</Badge>
				) : null}
				{dirty && !valid ? (
					<Badge variant="destructive">{t.realms.taxonomySettings.invalidDraft}</Badge>
				) : null}
			</div>
			<div className="flex flex-wrap items-center gap-2">
				<div className="relative min-w-56 flex-1">
					<Search
						aria-hidden
						className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
					/>
					<Input
						aria-label={t.realms.taxonomySettings.search}
						className="ps-9"
						onChange={(event) => setQuery(event.currentTarget.value)}
						placeholder={t.realms.taxonomySettings.searchPlaceholder}
						type="search"
						value={query}
					/>
				</div>
				<Button onClick={() => setAddRequest("label")} type="button" variant="outline">
					<FolderPlus aria-hidden />
					{t.realms.taxonomySettings.addLabel}
				</Button>
				<Button onClick={() => setAddRequest("tag")} type="button" variant="outline">
					<Tag aria-hidden />
					{t.realms.taxonomySettings.attachTag}
				</Button>
				<Button onClick={() => setAddRequest("wiki")} type="button" variant="outline">
					<FileText aria-hidden />
					{t.realms.taxonomySettings.attachWiki}
				</Button>
			</div>
			{selectedTagNodes.length ? (
				<div className="flex flex-wrap items-center gap-3 rounded-xl border border-border-weak bg-muted/25 p-3">
					<p className="text-sm">
						{t.realms.taxonomySettings.selectedCount({ count: selectedIds.size })}
					</p>
					<Field className="min-w-56" orientation="horizontal">
						<FieldLabel>{t.realms.taxonomySettings.bulkStrategy}</FieldLabel>
						<NativeSelect
							aria-label={t.realms.taxonomySettings.bulkStrategy}
							onChange={(event) => {
								if (isQueryStrategy(event.currentTarget.value))
									applyStrategy(event.currentTarget.value);
							}}
							value=""
						>
							<NativeSelectOption disabled value="">
								{t.realms.taxonomySettings.chooseStrategy}
							</NativeSelectOption>
							{RealmTaxonomyQueryStrategies.map((strategy) => (
								<NativeSelectOption key={strategy} value={strategy}>
									{t.realms.taxonomy.strategies[strategy].label}
								</NativeSelectOption>
							))}
						</NativeSelect>
					</Field>
					<Button
						onClick={() => setRemoveRequest(selectedIds)}
						type="button"
						variant="outline"
					>
						<Trash2 aria-hidden />
						{t.realms.taxonomySettings.remove}
					</Button>
				</div>
			) : null}
			<div className="overflow-clip rounded-xl border border-border-weak bg-background">
				{visibleEntries.length ? (
					<VirtualizedTreeRows
						ariaMultiselectable
						entries={visibleEntries}
						label={t.realms.taxonomySettings.treeLabel}
						pinnedNodeIds={draggingIds}
						renderRow={(visible) => {
							const { entry, depth, positionInSet, setSize } = visible;
							const node = entry.node;
							const expanded = effectiveExpandedIds.has(node.id);
							const selected = selectedIds.has(node.id);
							const title =
								node.title ||
								(node.contentKind === "tag"
									? t.tags.unnamedTag
									: t.realms.taxonomySettings.unnamed);
							return (
								<TreeEditorRowFrame
									activePlacement={
										dropTarget?.nodeId === node.id
											? dropTarget.placement
											: undefined
									}
									aria-expanded={parentIds.has(node.id) ? expanded : undefined}
									aria-level={depth + 1}
									aria-posinset={positionInSet}
									aria-selected={selected}
									aria-setsize={setSize}
									depth={depth}
									dragging={draggingIds.has(node.id)}
									onClick={(event: MouseEvent<HTMLDivElement>) =>
										activateNode(node.id, event)
									}
									onDragOver={(event) => handleDragOver(event, node.id)}
									onDrop={(event) => {
										event.preventDefault();
										completeDrop();
									}}
									role="treeitem"
									selected={selected}
								>
									<Button
										aria-label={
											selected
												? t.realms.taxonomySettings.deselect
												: t.realms.taxonomySettings.select
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
										aria-label={t.realms.taxonomySettings.move}
										className="cursor-grab touch-none text-muted-foreground active:cursor-grabbing"
										draggable
										onClick={(event) => event.stopPropagation()}
										onDragEnd={() => {
											setDraggingIds(EmptyIds);
											setDropTarget(undefined);
										}}
										onDragStart={(event) => {
											event.dataTransfer.effectAllowed = "move";
											beginDrag(node.id);
										}}
										type="button"
									>
										<GripVertical aria-hidden className="size-5" />
									</button>
									{parentIds.has(node.id) ? (
										<Button
											aria-label={
												expanded
													? t.realms.taxonomySettings.collapse
													: t.realms.taxonomySettings.expand
											}
											onClick={(event) => {
												event.stopPropagation();
												setExpandedIds((current) => {
													const next = new Set(current);
													if (next.has(node.id)) next.delete(node.id);
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
									<IdentityAvatar
										avatar={node.avatar}
										className="size-9"
										fallback={Array.from(title)[0]?.toLocaleUpperCase() ?? "?"}
									/>
									<div className="min-w-0 flex-1">
										<div className="flex min-w-0 items-center gap-2">
											{node.state === "new-label" ? (
												<Input
													aria-label={
														t.realms.taxonomySettings.labelTitle
													}
													className="h-9 max-w-md"
													onChange={(event) =>
														changeDraft((nodes) =>
															renameRealmTaxonomyLabel(
																nodes,
																node.id,
																event.currentTarget.value,
															),
														)
													}
													onClick={(event) => event.stopPropagation()}
													value={node.title}
												/>
											) : (
												<span className="truncate font-semibold">
													{title}
												</span>
											)}
											<Badge variant="outline">
												{t.realms.taxonomySettings.kinds[node.contentKind]}
											</Badge>
										</div>
										{node.summary ? (
											<p className="mt-1 line-clamp-1 text-muted-foreground text-xs">
												{node.summary}
											</p>
										) : null}
									</div>
									{node.contentKind === "tag" ? (
										<NativeSelect
											aria-label={t.realms.taxonomySettings.queryStrategy}
											className="hidden max-w-56 md:block"
											onChange={(event) => {
												event.stopPropagation();
												const strategy = event.currentTarget.value;
												if (!isQueryStrategy(strategy)) return;
												changeDraft((nodes) =>
													nodes.map((candidate) =>
														candidate.id === node.id &&
														candidate.contentKind === "tag"
															? {
																	...candidate,
																	queryStrategy: strategy,
																}
															: candidate,
													),
												);
											}}
											onClick={(event) => event.stopPropagation()}
											value={node.queryStrategy ?? "global_effective"}
										>
											{RealmTaxonomyQueryStrategies.map((strategy) => (
												<NativeSelectOption key={strategy} value={strategy}>
													{t.realms.taxonomy.strategies[strategy].label}
												</NativeSelectOption>
											))}
										</NativeSelect>
									) : null}
									<div className="hidden items-center gap-1 lg:flex">
										<TreeMoveButton
											label={t.realms.taxonomySettings.moveUp}
											onClick={() => moveNode(node.id, "up")}
										>
											<ArrowUp aria-hidden />
										</TreeMoveButton>
										<TreeMoveButton
											label={t.realms.taxonomySettings.moveDown}
											onClick={() => moveNode(node.id, "down")}
										>
											<ArrowDown aria-hidden />
										</TreeMoveButton>
										<TreeMoveButton
											label={t.realms.taxonomySettings.indent}
											onClick={() => moveNode(node.id, "indent")}
										>
											<ArrowRightToLine aria-hidden />
										</TreeMoveButton>
										<TreeMoveButton
											label={t.realms.taxonomySettings.outdent}
											onClick={() => moveNode(node.id, "outdent")}
										>
											<ArrowLeftFromLine aria-hidden />
										</TreeMoveButton>
										<TreeMoveButton
											label={t.realms.taxonomySettings.remove}
											onClick={() => setRemoveRequest(new Set([node.id]))}
										>
											<Trash2 aria-hidden />
										</TreeMoveButton>
									</div>
								</TreeEditorRowFrame>
							);
						}}
					/>
				) : (
					<div className="grid min-h-64 place-items-center p-8 text-center text-muted-foreground text-sm">
						{document.draft.length
							? t.realms.taxonomySettings.emptySearch
							: t.realms.taxonomySettings.empty}
					</div>
				)}
			</div>
			<RequestFailure error={save.error} />
			{addRequest ? (
				<AddTaxonomyNodeDialog
					kind={addRequest}
					onAdd={(value) => addNode(addRequest, value)}
					onClose={() => setAddRequest(undefined)}
				/>
			) : null}
			{removeRequest ? (
				<RemoveTaxonomyNodesDialog
					hasChildren={document.draft.some(
						(node) => node.parentId && removeRequest.has(node.parentId),
					)}
					onClose={() => setRemoveRequest(undefined)}
					onRemove={removeNodes}
				/>
			) : null}
		</div>
	);
}

function TreeMoveButton({
	children,
	label,
	onClick,
}: {
	readonly children: React.ReactNode;
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

function AddTaxonomyNodeDialog({
	kind,
	onAdd,
	onClose,
}: {
	readonly kind: AddRequest;
	readonly onAdd: (value: string | EntityPickerValue) => void;
	readonly onClose: () => void;
}) {
	const { t } = useTranslation(["realms", "ui"]);
	const [title, setTitle] = useState("");
	const [picked, setPicked] = useState<EntityPickerValue>();
	const label = t.realms.taxonomySettings.addKinds[kind];
	return (
		<Dialog onOpenChange={({ open }) => !open && onClose()} open>
			<DialogContent>
				<DialogHeader
					description={t.realms.taxonomySettings.addDescription}
					title={label}
				/>
				<DialogBody>
					<Field required>
						<FieldLabel>
							{kind === "label"
								? t.realms.taxonomySettings.labelTitle
								: t.realms.taxonomySettings.content}
						</FieldLabel>
						{kind === "label" ? (
							<Input
								autoFocus
								onChange={(event) => setTitle(event.currentTarget.value)}
								value={title}
							/>
						) : (
							<EntityPicker
								ariaLabel={label}
								index={kind === "tag" ? "tags" : "posts"}
								onChange={setPicked}
								placeholder={
									kind === "tag"
										? t.ui.pickerPlaceholders.tag
										: t.ui.pickerPlaceholders.post
								}
								value={picked}
							/>
						)}
					</Field>
				</DialogBody>
				<DialogFooter>
					<DialogClose asChild>
						<Button type="button" variant="quiet">
							{t.realms.taxonomySettings.cancel}
						</Button>
					</DialogClose>
					<Button
						disabled={kind === "label" ? !title.trim() : !picked}
						onClick={() => {
							if (kind === "label" && title.trim()) onAdd(title);
							else if (picked) onAdd(picked);
						}}
						type="button"
						variant="solid"
					>
						<Plus aria-hidden />
						{label}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

function RemoveTaxonomyNodesDialog({
	hasChildren,
	onClose,
	onRemove,
}: {
	readonly hasChildren: boolean;
	readonly onClose: () => void;
	readonly onRemove: (mode: "promote-children" | "subtree") => void;
}) {
	const { t } = useTranslation(["realms"]);
	return (
		<Dialog onOpenChange={({ open }) => !open && onClose()} open>
			<DialogContent>
				<DialogHeader
					description={
						hasChildren
							? t.realms.taxonomySettings.removeDescription
							: t.realms.taxonomySettings.removeLeafDescription
					}
					title={t.realms.taxonomySettings.removeTitle}
				/>
				<DialogFooter>
					<DialogClose asChild>
						<Button type="button" variant="quiet">
							{t.realms.taxonomySettings.cancel}
						</Button>
					</DialogClose>
					{hasChildren ? (
						<Button
							onClick={() => onRemove("promote-children")}
							type="button"
							variant="outline"
						>
							{t.realms.taxonomySettings.promoteChildren}
						</Button>
					) : null}
					<Button onClick={() => onRemove("subtree")} type="button" variant="destructive">
						{hasChildren
							? t.realms.taxonomySettings.removeSubtree
							: t.realms.taxonomySettings.remove}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
