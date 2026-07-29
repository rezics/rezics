"use client";

import {
	useDeleteApiCollectionsByCollectionIdItemsByTargetId,
	usePostApiCollectionsByCollectionIdItemsMove,
	usePutApiCollectionsByCollectionIdItemsByTargetId,
} from "@rezics/openapi-tanstack-query";
import {
	Button,
	Checkbox,
	Dialog,
	DialogBody,
	DialogContent,
	DialogFooter,
	DialogHeader,
	EntityPicker,
	Field,
	FieldGroup,
	FieldLabel,
	ManagementWorkspaceSectionHeader,
	NativeSelect,
	NativeSelectOption,
	QueryFailure,
	QueryPending,
} from "@rezics/ui";
import { useQueryClient } from "@tanstack/react-query";
import { CornerDownRightIcon, MoveIcon, Trash2Icon } from "lucide-react";
import { AppLink as Link } from "@/features/application-shell/components/app-link";
import { useMemo, useState, type FormEvent } from "react";

import { FeedItemCard } from "@/features/content-feed/components/feed-item-card";
import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import { useCollectionManagement } from "../components/collection-management-workspace";
import {
	collectionContentItems,
	type CollectionContentItem,
	useCollectionContent,
} from "../data/collection-content";
import { invalidateCollections } from "../data/collection-cache";
import {
	collectionSelectionSubtreeIds,
	toCollectionContentGroups,
	type CollectionContentGroup,
} from "../model/collection-content-tree";
import { collectionManagementHref } from "../routing/collection-management-routes";

type SelectedUnit = Readonly<{ id: string; label: string }>;
type MoveMode = "move" | "child";
type MovePlacementKind = "start" | "end" | "after";

function flattenCollectionItems(items: readonly CollectionContentItem[]) {
	const ordered: Array<{ readonly item: CollectionContentItem; readonly depth: number }> = [];
	const visit = (
		groups: readonly CollectionContentGroup<CollectionContentItem>[],
		depth: number,
	) => {
		for (const group of groups) {
			ordered.push({ item: group.root, depth });
			visit(group.children, depth + 1);
		}
	};
	visit(toCollectionContentGroups(items), 0);
	return ordered;
}

export function CollectionItemsPage() {
	const { collection } = useCollectionManagement();
	const { t } = useTranslation(["actions", "collections", "errors", "ui"]);
	const queryClient = useQueryClient();
	const content = useCollectionContent(collection.id, collection.capabilities.canManageItems);
	const add = usePutApiCollectionsByCollectionIdItemsByTargetId();
	const move = usePostApiCollectionsByCollectionIdItemsMove();
	const remove = useDeleteApiCollectionsByCollectionIdItemsByTargetId();
	const [selectedUnit, setSelectedUnit] = useState<SelectedUnit>();
	const [parentTargetId, setParentTargetId] = useState("");
	const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(() => new Set());
	const [moveMode, setMoveMode] = useState<MoveMode>();
	const [placementKind, setPlacementKind] = useState<MovePlacementKind>("end");
	const [destinationTargetId, setDestinationTargetId] = useState("");

	const items = collectionContentItems(content);
	const orderedItems = useMemo(() => flattenCollectionItems(items), [items]);
	const pending = add.isPending || move.isPending || remove.isPending;
	const movingSubtreeIds = useMemo(
		() => collectionSelectionSubtreeIds(items, selectedIds),
		[items, selectedIds],
	);
	const selectableDestinations = orderedItems.filter(
		({ item }) => !movingSubtreeIds.has(item.membership.targetId),
	);

	if (!collection.capabilities.canManageItems)
		return <p className="text-sm text-destructive">{t.errors.forbidden}</p>;
	if (content.isPending) return <QueryPending />;
	if (content.isError && !content.data)
		return <QueryFailure error={content.error} retry={() => void content.refetch()} />;

	async function refresh() {
		await invalidateCollections(queryClient, collection.id);
	}

	async function addItem(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (!selectedUnit) return;
		try {
			await add.mutateAsync({
				path: { collectionId: collection.id, targetId: selectedUnit.id },
				body: {
					baseRevisionId: collection.latestRevisionId,
					placement: "direct",
					parentTargetId: parentTargetId || null,
				},
			});
			setSelectedUnit(undefined);
			setParentTargetId("");
			await refresh();
		} catch {
			// The typed mutation state supplies the visible API error.
		}
	}

	async function removeItem(item: CollectionContentItem) {
		try {
			await remove.mutateAsync({
				path: {
					collectionId: collection.id,
					targetId: item.membership.targetId,
				},
				body: { baseRevisionId: collection.latestRevisionId },
			});
			setSelectedIds((current) => {
				const next = new Set(current);
				next.delete(item.membership.targetId);
				return next;
			});
			await refresh();
		} catch {
			// The typed mutation state supplies the visible API error.
		}
	}

	async function submitMove() {
		if (!moveMode || !selectedIds.size) return;
		const placement =
			moveMode === "child"
				? { kind: "end" as const, parentTargetId: destinationTargetId }
				: placementKind === "after"
					? { kind: "after" as const, targetId: destinationTargetId }
					: { kind: placementKind, parentTargetId: null };
		try {
			await move.mutateAsync({
				path: { collectionId: collection.id },
				body: {
					baseRevisionId: collection.latestRevisionId,
					targetIds: [...selectedIds],
					placement,
				},
			});
			setSelectedIds(new Set());
			closeMoveDialog();
			await refresh();
		} catch {
			// The typed mutation state supplies the visible API error.
		}
	}

	function closeMoveDialog() {
		setMoveMode(undefined);
		setPlacementKind("end");
		setDestinationTargetId("");
	}

	function toggleSelection(targetId: string, checked: boolean) {
		setSelectedIds((current) => {
			const next = new Set(current);
			if (checked) next.add(targetId);
			else next.delete(targetId);
			return next;
		});
	}

	const destinationRequired = moveMode === "child" || placementKind === "after";
	return (
		<section className="grid gap-6">
			<ManagementWorkspaceSectionHeader
				backHref={collectionManagementHref(collection.id)}
				backLabel={t.collections.workspace.backToContent}
				description={t.collections.workspace.sections.items.description}
				link={Link}
				title={t.collections.workspace.sections.items.label}
			/>
			<form
				className="grid gap-4 rounded-2xl border border-border-weak p-4"
				onSubmit={(event) => void addItem(event)}
			>
				<FieldGroup>
					<Field required>
						<FieldLabel>{t.collections.items.target}</FieldLabel>
						<EntityPicker
							index="units"
							onChange={setSelectedUnit}
							value={selectedUnit}
						/>
					</Field>
					<Field>
						<FieldLabel>{t.collections.items.parent}</FieldLabel>
						<NativeSelect
							onChange={(event) => setParentTargetId(event.currentTarget.value)}
							value={parentTargetId}
						>
							<NativeSelectOption value="">
								{t.collections.items.topLevel}
							</NativeSelectOption>
							{orderedItems.map(({ item }) => (
								<NativeSelectOption
									key={item.membership.targetId}
									value={item.membership.targetId}
								>
									{item.content.title ?? t.ui.unnamed}
								</NativeSelectOption>
							))}
						</NativeSelect>
					</Field>
				</FieldGroup>
				<Button
					className="w-fit"
					disabled={!selectedUnit}
					isLoading={add.isPending}
					type="submit"
					variant="solid"
				>
					{t.collections.items.add}
				</Button>
			</form>
			<RequestFailure
				error={add.error ?? move.error ?? remove.error ?? content.error}
				fallback={t.ui.retryLater}
			/>
			{orderedItems.length ? (
				<div className="grid gap-4">
					<div className="flex flex-wrap items-center gap-2 rounded-xl border border-border-weak bg-surface-raised p-3">
						<Button
							disabled={pending || selectedIds.size === orderedItems.length}
							onClick={() =>
								setSelectedIds(
									new Set(
										orderedItems.map(({ item }) => item.membership.targetId),
									),
								)
							}
							size="sm"
							variant="outline"
						>
							{t.collections.items.selectAll}
						</Button>
						<Button
							disabled={pending || !selectedIds.size}
							onClick={() => setSelectedIds(new Set())}
							size="sm"
							variant="quiet"
						>
							{t.collections.items.clearSelection}
						</Button>
						<span className="me-auto text-muted-foreground text-sm">
							{t.collections.items.selectedCount({ count: selectedIds.size })}
						</span>
						<Button
							disabled={pending || !selectedIds.size}
							onClick={() => setMoveMode("move")}
							size="sm"
							variant="outline"
						>
							<MoveIcon aria-hidden />
							{t.collections.items.move}
						</Button>
						<Button
							disabled={
								pending || !selectedIds.size || !selectableDestinations.length
							}
							onClick={() => setMoveMode("child")}
							size="sm"
							variant="outline"
						>
							<CornerDownRightIcon aria-hidden />
							{t.collections.items.setAsChild}
						</Button>
					</div>
					{orderedItems.map(({ item, depth }) => {
						const targetId = item.membership.targetId;
						const title = item.content.title ?? t.ui.unnamed;
						return (
							<div
								className="grid gap-2"
								key={targetId}
								style={{ marginInlineStart: `${Math.min(depth, 6) * 1.25}rem` }}
							>
								<div className="flex items-center gap-3 rounded-xl border border-border-weak bg-surface-raised p-3">
									<Checkbox
										aria-label={t.collections.items.selectItem({ title })}
										checked={selectedIds.has(targetId)}
										disabled={pending}
										onCheckedChange={({ checked }) =>
											toggleSelection(targetId, checked === true)
										}
									/>
									<span className="min-w-0 flex-1 truncate font-medium text-sm">
										{title}
									</span>
									<Button
										aria-label={t.collections.items.removeItem({ title })}
										disabled={pending}
										onClick={() => void removeItem(item)}
										size="icon-sm"
										variant="destructive"
									>
										<Trash2Icon aria-hidden />
									</Button>
								</div>
								<FeedItemCard item={item.content} />
							</div>
						);
					})}
				</div>
			) : (
				<p className="text-sm text-muted-foreground">{t.collections.items.empty}</p>
			)}
			{content.hasNextPage ? (
				<Button
					className="mx-auto w-fit"
					isLoading={content.isFetchingNextPage}
					onClick={() => void content.fetchNextPage()}
					variant="outline"
				>
					{t.actions.loadMore}
				</Button>
			) : null}
			<Dialog
				onOpenChange={({ open }) => {
					if (!open) closeMoveDialog();
				}}
				open={Boolean(moveMode)}
			>
				<DialogContent showCloseButton={!move.isPending} size="sm">
					<DialogHeader
						description={t.collections.items.moveDescription}
						title={
							moveMode === "child"
								? t.collections.items.childTitle
								: t.collections.items.moveTitle
						}
					/>
					<DialogBody>
						<FieldGroup>
							{moveMode === "move" ? (
								<Field>
									<FieldLabel>{t.collections.items.destination}</FieldLabel>
									<NativeSelect
										disabled={move.isPending}
										onChange={(event) => {
											setPlacementKind(
												event.currentTarget.value as MovePlacementKind,
											);
											setDestinationTargetId("");
										}}
										value={placementKind}
									>
										<NativeSelectOption value="start">
											{t.collections.items.moveToStart}
										</NativeSelectOption>
										<NativeSelectOption value="end">
											{t.collections.items.moveToEnd}
										</NativeSelectOption>
										<NativeSelectOption value="after">
											{t.collections.items.moveAfter}
										</NativeSelectOption>
									</NativeSelect>
								</Field>
							) : null}
							{destinationRequired ? (
								<Field required>
									<FieldLabel>
										{moveMode === "child"
											? t.collections.items.parent
											: t.collections.items.afterItem}
									</FieldLabel>
									<NativeSelect
										disabled={move.isPending}
										onChange={(event) =>
											setDestinationTargetId(event.currentTarget.value)
										}
										value={destinationTargetId}
									>
										<NativeSelectOption value="">
											{t.collections.items.chooseDestination}
										</NativeSelectOption>
										{selectableDestinations.map(({ item }) => (
											<NativeSelectOption
												key={item.membership.targetId}
												value={item.membership.targetId}
											>
												{item.content.title ?? t.ui.unnamed}
											</NativeSelectOption>
										))}
									</NativeSelect>
								</Field>
							) : null}
						</FieldGroup>
						<RequestFailure error={move.error} fallback={t.ui.retryLater} />
					</DialogBody>
					<DialogFooter>
						<Button
							disabled={move.isPending}
							onClick={closeMoveDialog}
							variant="outline"
						>
							{t.collections.cancel}
						</Button>
						<Button
							disabled={
								!selectedIds.size || (destinationRequired && !destinationTargetId)
							}
							isLoading={move.isPending}
							onClick={() => void submitMove()}
							variant="solid"
						>
							{t.collections.items.applyMove}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</section>
	);
}
