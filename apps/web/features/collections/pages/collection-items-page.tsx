"use client";

import {
	useDeleteApiCollectionsByCollectionIdItemsByTargetId,
	usePutApiCollectionsByCollectionIdItemsByTargetId,
} from "@rezics/openapi-tanstack-query";
import {
	Button,
	ChoiceSelect,
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
import { generateKeyBetween } from "fractional-indexing";
import { ArrowDownIcon, ArrowUpIcon, StarIcon, Trash2Icon } from "lucide-react";
import Link from "next/link";
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
type EditableCollectionRole = "item" | "featured";

export function CollectionItemsPage() {
	const { collection } = useCollectionManagement();
	const { t } = useTranslation(["actions", "collections", "errors", "ui"]);
	const queryClient = useQueryClient();
	const content = useCollectionContent(collection.id, collection.capabilities.canManageItems);
	const addOrUpdate = usePutApiCollectionsByCollectionIdItemsByTargetId();
	const remove = useDeleteApiCollectionsByCollectionIdItemsByTargetId();
	const [selectedUnit, setSelectedUnit] = useState<SelectedUnit>();
	const [role, setRole] = useState<EditableCollectionRole>("item");
	const [parentTargetId, setParentTargetId] = useState("");
	if (!collection.capabilities.canManageItems)
		return <p className="text-sm text-destructive">{t.errors.forbidden}</p>;
	if (content.isPending) return <QueryPending />;
	if (content.isError && !content.data)
		return <QueryFailure error={content.error} retry={() => void content.refetch()} />;
	const items = collectionContentItems(content);
	const pending = addOrUpdate.isPending || remove.isPending;

	async function refresh() {
		await invalidateCollections(queryClient, collection.id);
	}

	async function addItem(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (!selectedUnit) return;
		try {
			await addOrUpdate.mutateAsync({
				path: { collectionId: collection.id, targetId: selectedUnit.id },
				body: {
					baseRevisionId: collection.latestRevisionId,
					placement: "direct",
					parentTargetId: parentTargetId || null,
					role,
				},
			});
			setSelectedUnit(undefined);
			setRole("item");
			setParentTargetId("");
			await refresh();
		} catch {
			// The typed mutation state supplies the visible API error.
		}
	}

	async function updateItem(
		item: CollectionContentItem,
		changes: {
			readonly parentTargetId?: string | null;
			readonly position?: string;
			readonly role?: EditableCollectionRole;
		},
	) {
		try {
			await addOrUpdate.mutateAsync({
				path: {
					collectionId: collection.id,
					targetId: item.membership.targetId,
				},
				body: {
					baseRevisionId: collection.latestRevisionId,
					placement: "direct",
					parentTargetId:
						changes.parentTargetId === undefined
							? item.membership.parentTargetId
							: changes.parentTargetId,
					position: changes.position,
					role: changes.role ?? toEditableRole(item.membership.role),
				},
			});
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
			await refresh();
		} catch {
			// The typed mutation state supplies the visible API error.
		}
	}

	function moveItem(index: number, direction: "earlier" | "later") {
		const item = items[index];
		if (!item) return;
		const position =
			direction === "earlier"
				? generateKeyBetween(
						items[index - 2]?.membership.position ?? null,
						items[index - 1]?.membership.position ?? null,
					)
				: generateKeyBetween(
						items[index + 1]?.membership.position ?? null,
						items[index + 2]?.membership.position ?? null,
					);
		void updateItem(item, { position });
	}

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
							index="units"
							onChange={setSelectedUnit}
							value={selectedUnit}
						/>
					</Field>
					<div className="grid gap-4 sm:grid-cols-2">
						<Field>
							<FieldLabel>{t.collections.items.role}</FieldLabel>
							<ChoiceSelect
								appearance="field"
								ariaLabel={t.collections.items.role}
								className="w-full"
								onValueChange={([value]) => {
									if (value) setRole(value);
								}}
								options={[
									{ value: "item", label: t.collections.items.item },
									{ value: "featured", label: t.collections.items.featured },
								]}
								placeholder={t.collections.items.role}
								value={[role]}
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
								{items.map((item) => (
									<NativeSelectOption
										key={item.membership.targetId}
										value={item.membership.targetId}
									>
										{item.content.title ?? t.ui.unnamed}
									</NativeSelectOption>
								))}
							</NativeSelect>
						</Field>
					</div>
				</FieldGroup>
				<Button
					className="w-fit"
					disabled={!selectedUnit}
					isLoading={addOrUpdate.isPending}
					type="submit"
					variant="solid"
				>
					{t.collections.items.add}
				</Button>
			</form>
			<RequestFailure
				error={addOrUpdate.error ?? remove.error ?? content.error}
				fallback={t.ui.retryLater}
			/>
			{items.length ? (
				<div className="grid gap-4">
					{items.map((item, index) => {
						const currentRole = toEditableRole(item.membership.role);
						return (
							<div className="grid gap-2" key={item.membership.targetId}>
								<div className="flex flex-wrap items-center gap-2 rounded-xl border border-border-weak bg-surface-raised p-2">
									<Button
										aria-label={
											currentRole === "featured"
												? t.collections.items.item
												: t.collections.items.featured
										}
										disabled={pending}
										onClick={() =>
											void updateItem(item, {
												role:
													currentRole === "featured"
														? "item"
														: "featured",
											})
										}
										size="sm"
										variant={
											currentRole === "featured" ? "secondary" : "outline"
										}
									>
										<StarIcon
											aria-hidden
											fill={
												currentRole === "featured" ? "currentColor" : "none"
											}
										/>
										{currentRole === "featured"
											? t.collections.items.featured
											: t.collections.items.item}
									</Button>
									<NativeSelect
										aria-label={t.collections.items.parent}
										className="min-w-44 flex-1"
										disabled={pending}
										onChange={(event) =>
											void updateItem(item, {
												parentTargetId: event.currentTarget.value || null,
											})
										}
										value={item.membership.parentTargetId ?? ""}
									>
										<NativeSelectOption value="">
											{t.collections.items.topLevel}
										</NativeSelectOption>
										{items
											.filter(
												(candidate) =>
													candidate.membership.targetId !==
													item.membership.targetId,
											)
											.map((candidate) => (
												<NativeSelectOption
													key={candidate.membership.targetId}
													value={candidate.membership.targetId}
												>
													{candidate.content.title ?? t.ui.unnamed}
												</NativeSelectOption>
											))}
									</NativeSelect>
									{collection.presentationDocument.order === "manual" ? (
										<>
											<Button
												aria-label={t.collections.items.moveEarlier}
												disabled={pending || index === 0}
												onClick={() => moveItem(index, "earlier")}
												size="icon-sm"
												variant="outline"
											>
												<ArrowUpIcon aria-hidden />
											</Button>
											<Button
												aria-label={t.collections.items.moveLater}
												disabled={pending || index === items.length - 1}
												onClick={() => moveItem(index, "later")}
												size="icon-sm"
												variant="outline"
											>
												<ArrowDownIcon aria-hidden />
											</Button>
										</>
									) : null}
									<Button
										aria-label={t.collections.items.remove}
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
		</section>
	);
}

function toEditableRole(role: CollectionContentItem["membership"]["role"]): EditableCollectionRole {
	return role === "featured" ? "featured" : "item";
}
