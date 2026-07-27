"use client";

import { toContentLanguage } from "@rezics/i18n";
import {
	useDeleteApiCollectionsByCollectionIdItemsByTargetId,
	useDeleteApiCollectionsFavoritesItemsByTargetId,
	useGetApiCollections,
	useGetApiUsersMe,
	usePostApiCollections,
	usePutApiCollectionsByCollectionIdItemsByTargetId,
	usePutApiCollectionsFavoritesItemsByTargetId,
} from "@rezics/openapi-tanstack-query";
import { useQueryClient } from "@tanstack/react-query";
import { BookmarkIcon, CheckIcon, LibraryIcon, PlusIcon } from "lucide-react";
import Link from "next/link";
import { useId, useState, type FormEvent } from "react";

import {
	Button,
	Dialog,
	DialogBody,
	DialogContent,
	DialogFooter,
	DialogHeader,
	Input,
} from "@rezics/ui";
import { useAuthPortal } from "@/features/auth/auth-portal";
import { useTranslation } from "@/i18n/client";
import { useLocalizationLanguages } from "@/i18n/use-localization-languages";
import { RequestFailure } from "@/i18n/request-failure";
import { useHydratedSession } from "@/lib/use-hydrated-session";
import { invalidateCollections } from "../data/collection-cache";

export type CollectionSavePlacement = "direct" | "review-with-subject";

export function CollectionSaveControl({
	onOpenChange,
	open: controlledOpen,
	placement = "direct",
	targetId,
	triggerClassName,
	triggerVariant,
}: {
	readonly onOpenChange?: (open: boolean) => void;
	readonly open?: boolean;
	readonly placement?: CollectionSavePlacement;
	readonly targetId: string;
	readonly triggerClassName?: string;
	readonly triggerVariant?: "outline" | "secondary" | "quiet";
}) {
	const { locale, t } = useTranslation(["collections", "ui"]);
	const { data: session } = useHydratedSession();
	const { openAuthPortal } = useAuthPortal();
	const queryClient = useQueryClient();
	const localizationLanguages = useLocalizationLanguages();
	const formId = useId();
	const [internalOpen, setInternalOpen] = useState(false);
	const [changingCollectionId, setChangingCollectionId] = useState<string>();
	const [destinationQuery, setDestinationQuery] = useState("");
	const [newCollectionTitle, setNewCollectionTitle] = useState("");
	const open = controlledOpen ?? internalOpen;
	const setOpen = onOpenChange ?? setInternalOpen;
	const me = useGetApiUsersMe({ query: { enabled: open && Boolean(session) } });
	const collections = useGetApiCollections(
		{
			query: {
				...(me.data?.id ? { ownerId: me.data.id } : {}),
				targetId,
				localizationLanguages,
				limit: 50,
			},
		},
		{ query: { enabled: open && Boolean(me.data?.id) } },
	);
	const create = usePostApiCollections();
	const add = usePutApiCollectionsByCollectionIdItemsByTargetId();
	const remove = useDeleteApiCollectionsByCollectionIdItemsByTargetId();
	const addFavorite = usePutApiCollectionsFavoritesItemsByTargetId();
	const removeFavorite = useDeleteApiCollectionsFavoritesItemsByTargetId();
	const pending =
		create.isPending ||
		add.isPending ||
		remove.isPending ||
		addFavorite.isPending ||
		removeFavorite.isPending;

	function requestOpen() {
		if (!session) openAuthPortal("login");
		else setOpen(true);
	}

	async function toggleCollection(
		collection: NonNullable<typeof collections.data>["items"][number],
	) {
		setChangingCollectionId(collection.id);
		try {
			if (collection.systemKey === "favorites") {
				if (collection.containsTarget)
					await removeFavorite.mutateAsync({
						path: { targetId },
						body: { baseRevisionId: collection.latestRevisionId },
					});
				else
					await addFavorite.mutateAsync({
						path: { targetId },
						body: { baseRevisionId: collection.latestRevisionId },
					});
			} else if (collection.containsTarget) {
				await remove.mutateAsync({
					path: { collectionId: collection.id, targetId },
					body: { baseRevisionId: collection.latestRevisionId },
				});
			} else {
				await add.mutateAsync({
					path: { collectionId: collection.id, targetId },
					body: {
						baseRevisionId: collection.latestRevisionId,
						placement,
						role: "item",
					},
				});
			}
			await invalidateCollections(queryClient, collection.id);
		} catch {
			// Queries remain the source of confirmed membership state.
		} finally {
			setChangingCollectionId(undefined);
		}
	}

	async function createAndSave(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const title = newCollectionTitle.trim();
		if (!title) return;
		try {
			const created = await create.mutateAsync({
				body: {
					localization: {
						language: toContentLanguage(locale.target),
						title,
					},
					visibility: "private",
				},
			});
			await add.mutateAsync({
				path: { collectionId: created.id, targetId },
				body: {
					baseRevisionId: created.latestRevisionId,
					placement,
					role: "item",
				},
			});
			setNewCollectionTitle("");
			await invalidateCollections(queryClient, created.id);
		} catch {
			// The typed mutation states supply the visible API error.
		}
	}

	const allDestinations = [...(collections.data?.items ?? [])]
		.filter(({ acceptsItems }) => acceptsItems)
		.sort(
			(left, right) =>
				Number(right.systemKey === "favorites") - Number(left.systemKey === "favorites"),
		);
	const normalizedDestinationQuery = destinationQuery.trim().toLocaleLowerCase(locale.target);
	const destinations = allDestinations.filter((collection) => {
		if (!normalizedDestinationQuery) return true;
		const title =
			collection.systemKey === "favorites"
				? t.collections.favorites
				: (collection.title ?? t.ui.unnamed);
		return title.toLocaleLowerCase(locale.target).includes(normalizedDestinationQuery);
	});
	const description =
		placement === "review-with-subject"
			? t.collections.save.reviewDescription
			: t.collections.save.directDescription;

	return (
		<Dialog onOpenChange={({ open: nextOpen }) => setOpen(nextOpen)} open={open}>
			{triggerVariant ? (
				<Button
					className={triggerClassName}
					onClick={requestOpen}
					size="sm"
					variant={triggerVariant}
				>
					<BookmarkIcon aria-hidden data-icon="inline-start" />
					{t.collections.save.action}
				</Button>
			) : null}
			<DialogContent showCloseButton={false} size="sm">
				<DialogHeader description={description} title={t.collections.save.title} />
				<DialogBody className="grid gap-4">
					<div className="grid gap-2">
						<label className="font-medium text-sm" htmlFor={`${formId}-search`}>
							{t.collections.save.searchLabel}
						</label>
						<Input
							id={`${formId}-search`}
							onChange={(event) => setDestinationQuery(event.currentTarget.value)}
							placeholder={t.collections.save.searchPlaceholder}
							value={destinationQuery}
						/>
					</div>
					<div className="grid gap-2">
						{collections.isPending || me.isPending ? (
							<p className="text-sm text-muted-foreground">{t.ui.loading}</p>
						) : destinations.length ? (
							destinations.map((collection) => {
								const isFavorite = collection.systemKey === "favorites";
								const selfReference = collection.id === targetId;
								return (
									<Button
										aria-pressed={collection.containsTarget}
										className="h-auto min-h-11 justify-between whitespace-normal py-2 text-start"
										disabled={
											selfReference ||
											pending ||
											changingCollectionId === collection.id
										}
										key={collection.id}
										onClick={() => void toggleCollection(collection)}
										variant={
											collection.containsTarget ? "secondary" : "outline"
										}
									>
										<span className="flex min-w-0 items-center gap-2">
											{isFavorite ? (
												<BookmarkIcon aria-hidden className="shrink-0" />
											) : (
												<LibraryIcon aria-hidden className="shrink-0" />
											)}
											<span className="truncate">
												{isFavorite
													? t.collections.favorites
													: (collection.title ?? t.ui.unnamed)}
											</span>
										</span>
										{collection.containsTarget ? (
											<CheckIcon aria-hidden className="shrink-0" />
										) : null}
									</Button>
								);
							})
						) : (
							<p className="text-sm text-muted-foreground">
								{allDestinations.length
									? t.collections.save.noMatches
									: t.collections.save.noCollections}
							</p>
						)}
					</div>
					<form
						className="grid gap-2 rounded-xl border border-border-weak p-3"
						onSubmit={(event) => void createAndSave(event)}
					>
						<label className="font-medium text-sm" htmlFor={`${formId}-new-title`}>
							{t.collections.save.createLabel}
						</label>
						<div className="flex gap-2">
							<Input
								id={`${formId}-new-title`}
								maxLength={500}
								onChange={(event) =>
									setNewCollectionTitle(event.currentTarget.value)
								}
								placeholder={t.collections.save.createPlaceholder}
								value={newCollectionTitle}
							/>
							<Button
								aria-label={t.collections.save.createAndSave}
								disabled={!newCollectionTitle.trim()}
								isLoading={create.isPending}
								size="icon-md"
								type="submit"
								variant="solid"
							>
								<PlusIcon aria-hidden />
							</Button>
						</div>
					</form>
					<RequestFailure
						error={
							me.error ??
							collections.error ??
							create.error ??
							add.error ??
							remove.error ??
							addFavorite.error ??
							removeFavorite.error
						}
						fallback={t.ui.retryLater}
					/>
				</DialogBody>
				<DialogFooter className="justify-between border-t">
					<Button asChild variant="quiet">
						<Link href="/collections">{t.collections.save.manage}</Link>
					</Button>
					<Button onClick={() => setOpen(false)} variant="secondary">
						{t.collections.close}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
