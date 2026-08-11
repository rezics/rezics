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
import { MoveIcon, Trash2Icon } from "lucide-react";
import { AppLink as Link } from "@/features/application-shell/components/app-link";
import { useState, type FormEvent } from "react";

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
import { collectionManagementHref } from "../routing/collection-management-routes";

type SelectedUnit = Readonly<{ id: string; label: string }>;
type MovePlacementKind = "start" | "end" | "after";

export function CollectionItemsPage() {
	const { collection } = useCollectionManagement();
	const { t } = useTranslation(["actions", "collections", "errors", "ui"]);
	const queryClient = useQueryClient();
	const content = useCollectionContent(collection.id, collection.capabilities.canManageItems);
	const add = usePutApiCollectionsByCollectionIdItemsByTargetId();
	const move = usePostApiCollectionsByCollectionIdItemsMove();
	const remove = useDeleteApiCollectionsByCollectionIdItemsByTargetId();
	const [selectedUnit, setSelectedUnit] = useState<SelectedUnit>();
	const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(() => new Set());
	const [moveDialogOpen, setMoveDialogOpen] = useState(false);
	const [placementKind, setPlacementKind] = useState<MovePlacementKind>("end");
	const [destinationTargetId, setDestinationTargetId] = useState("");

	const items = collectionContentItems(content);
	const pending = add.isPending || move.isPending || remove.isPending;
	const selectableDestinations = items.filter((item) => !selectedIds.has(item.membership.targetId));

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
					baseItemsRevisionId: collection.latestItemsRevisionId,
				},
			});
			setSelectedUnit(undefined);
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
				body: { baseItemsRevisionId: collection.latestItemsRevisionId },
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
		if (!moveDialogOpen || !selectedIds.size) return;
		const placement =
			placementKind === "after"
				? { kind: "after" as const, targetId: destinationTargetId }
				: { kind: placementKind };
		try {
			await move.mutateAsync({
				path: { collectionId: collection.id },
				body: {
					baseItemsRevisionId: collection.latestItemsRevisionId,
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
		setMoveDialogOpen(false);
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

	const destinationRequired = placementKind === "after";
	return (
		<section className="grid gap-6">
			<ManagementWorkspaceSectionHeader
				backHref={collectionManagementHref(collection.id)}
				backLabel={t.collections.workspace.backToOverview}
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
							ariaLabel={t.collections.items.target}
							index="units"
							onChange={setSelectedUnit}
							placeholder={t.ui.pickerPlaceholders.unit}
							value={selectedUnit}
						/>
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
			{items.length ? (
				<div className="grid gap-4">
					<div className="flex flex-wrap items-center gap-2 rounded-xl border border-border-weak bg-surface-raised p-3">
						<Button
							disabled={pending || selectedIds.size === items.length}
							onClick={() => setSelectedIds(new Set(items.map((item) => item.membership.targetId)))}
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
							onClick={() => setMoveDialogOpen(true)}
							size="sm"
							variant="outline"
						>
							<MoveIcon aria-hidden />
							{t.collections.items.move}
						</Button>
					</div>
					{items.map((item) => {
						const targetId = item.membership.targetId;
						const title = item.content.title ?? t.ui.unnamed;
						return (
							<div className="grid gap-2" key={targetId}>
								<div className="flex items-center gap-3 rounded-xl border border-border-weak bg-surface-raised p-3">
									<Checkbox
										aria-label={t.collections.items.selectItem({ title })}
										checked={selectedIds.has(targetId)}
										disabled={pending}
										onCheckedChange={({ checked }) => toggleSelection(targetId, checked === true)}
									/>
									<span className="min-w-0 flex-1 truncate font-medium text-sm">{title}</span>
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
				open={moveDialogOpen}
			>
				<DialogContent showCloseButton={!move.isPending} size="sm">
					<DialogHeader
						description={t.collections.items.moveDescription}
						title={t.collections.items.moveTitle}
					/>
					<DialogBody>
						<FieldGroup>
							<Field>
								<FieldLabel>{t.collections.items.destination}</FieldLabel>
								<NativeSelect
									disabled={move.isPending}
									onChange={(event) => {
										setPlacementKind(event.currentTarget.value as MovePlacementKind);
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
							{destinationRequired ? (
								<Field required>
									<FieldLabel>{t.collections.items.afterItem}</FieldLabel>
									<NativeSelect
										disabled={move.isPending}
										onChange={(event) => setDestinationTargetId(event.currentTarget.value)}
										value={destinationTargetId}
									>
										<NativeSelectOption value="">
											{t.collections.items.chooseDestination}
										</NativeSelectOption>
										{selectableDestinations.map((item) => (
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
						<Button disabled={move.isPending} onClick={closeMoveDialog} variant="outline">
							{t.collections.cancel}
						</Button>
						<Button
							disabled={!selectedIds.size || (destinationRequired && !destinationTargetId)}
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
