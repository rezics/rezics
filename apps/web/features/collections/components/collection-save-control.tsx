"use client";

import {
	useDeleteApiCollectionsByCollectionIdItemsByTargetId,
	useDeleteApiCollectionsFavoritesItemsByTargetId,
	useGetApiUsersMe,
	usePostApiCollections,
	usePutApiCollectionsByCollectionIdItemsByTargetId,
	usePutApiCollectionsFavoritesItemsByTargetId,
} from "@rezics/openapi-tanstack-query";
import { useQueryClient } from "@tanstack/react-query";
import { BookmarkIcon, PlusIcon } from "lucide-react";
import { AppLink as Link } from "@/features/application-shell/components/app-link";
import { useCallback, useDeferredValue, useId, useState, type FormEvent } from "react";

import { Button, Dialog, DialogContent, DialogFooter, DialogHeader, Input } from "@rezics/ui";
import { useAuthPortal } from "@/features/auth/auth-portal-context";
import { DraftContentLanguageField } from "@/features/content-languages/components/draft-content-language-field";
import { useDraftContentLanguage } from "@/features/content-languages/hooks/use-draft-content-language";
import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import { useHydratedSession } from "@/lib/use-hydrated-session";
import { invalidateCollections } from "../data/collection-cache";
import {
	collectionListItems,
	type CollectionListItem,
	useCollectionList,
} from "../data/collection-list";
import { CollectionDestinationList } from "./collection-destination-list";

// ```progress
// id: collections.favorite-removal-feedback
// status: open
// goal: Give immediate localized confirmation when a person removes an item from Favorites.
// depends: []
// accept:
//   - Successful Favorites removal produces an accessible localized confirmation after the server accepts the mutation.
//   - The confirmation remains understandable when the destination dialog or current model disappears after cache invalidation.
//   - Failed and superseded mutations never produce a false success message.
//   - Add, remove, retry, keyboard, and screen-reader behavior remain consistent with shared feedback conventions.
// verify:
//   - Exercise successful, failed, retried, and overlapping Favorites mutations in the component tests.
//   - Verify every new visible and accessibility string through the typed localization policy check.
//   - Run the Collections frontend typecheck and tests.
// ```
export function CollectionSaveControl({
	onOpenChange,
	open: controlledOpen,
	targetId,
	triggerClassName,
	triggerVariant,
}: {
	readonly onOpenChange?: (open: boolean) => void;
	readonly open?: boolean;
	readonly targetId: string;
	readonly triggerClassName?: string;
	readonly triggerVariant?: "outline" | "secondary" | "quiet";
}) {
	const { t } = useTranslation(["actions", "collections", "ui"]);
	const { data: session } = useHydratedSession();
	const { openAuthPortal } = useAuthPortal();
	const queryClient = useQueryClient();
	const formId = useId();
	const [internalOpen, setInternalOpen] = useState(false);
	const [changingCollectionId, setChangingCollectionId] = useState<string>();
	const [destinationQuery, setDestinationQuery] = useState("");
	const deferredDestinationQuery = useDeferredValue(destinationQuery.trim());
	const [destinationOverrides, setDestinationOverrides] = useState<
		ReadonlyMap<
			string,
			{
				readonly containsTarget: boolean;
				readonly latestItemsRevisionId: string;
			}
		>
	>(() => new Map());
	const [newCollectionTitle, setNewCollectionTitle] = useState("");
	const newCollectionLanguage = useDraftContentLanguage(newCollectionTitle);
	const open = controlledOpen ?? internalOpen;
	const setOpen = onOpenChange ?? setInternalOpen;
	const me = useGetApiUsersMe({}, { query: { enabled: open && Boolean(session) } });
	const collections = useCollectionList({
		acceptsItemsOnly: true,
		editableOnly: true,
		enabled: open && Boolean(me.data?.id),
		search: deferredDestinationQuery,
		targetId,
	});
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

	async function toggleCollection(collection: CollectionListItem) {
		setChangingCollectionId(collection.id);
		try {
			let latestItemsRevisionId: string;
			if (collection.purpose === "favorites") {
				if (collection.containsTarget)
					latestItemsRevisionId = (
						await removeFavorite.mutateAsync({
							path: { targetId },
							body: {
								baseItemsRevisionId: collection.latestItemsRevisionId,
							},
						})
					).latestItemsRevisionId;
				else
					latestItemsRevisionId = (
						await addFavorite.mutateAsync({
							path: { targetId },
							body: {
								baseItemsRevisionId: collection.latestItemsRevisionId,
							},
						})
					).latestItemsRevisionId;
			} else if (collection.containsTarget) {
				latestItemsRevisionId = (
					await remove.mutateAsync({
						path: { collectionId: collection.id, targetId },
						body: {
							baseItemsRevisionId: collection.latestItemsRevisionId,
						},
					})
				).latestItemsRevisionId;
			} else {
				latestItemsRevisionId = (
					await add.mutateAsync({
						path: { collectionId: collection.id, targetId },
						body: {
							baseItemsRevisionId: collection.latestItemsRevisionId,
						},
					})
				).latestItemsRevisionId;
			}
			setDestinationOverrides((current) => {
				const next = new Map(current);
				next.set(collection.id, {
					containsTarget: !collection.containsTarget,
					latestItemsRevisionId,
				});
				return next;
			});
			void invalidateCollections(queryClient, collection.id);
		} catch {
			// The visible mutation error preserves the last confirmed membership state.
		} finally {
			setChangingCollectionId(undefined);
		}
	}

	const loadNextPage = useCallback(() => {
		void collections.fetchNextPage();
	}, [collections.fetchNextPage]);

	function updateOpen(nextOpen: boolean) {
		if (!nextOpen) {
			setDestinationQuery("");
			setDestinationOverrides(new Map());
			setChangingCollectionId(undefined);
		}
		setOpen(nextOpen);
	}

	async function createAndSave(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const title = newCollectionTitle.trim();
		if (!title) return;
		const contentLanguage = await newCollectionLanguage.resolveLanguage(title);
		try {
			const created = await create.mutateAsync({
				body: {
					localization: {
						language: contentLanguage,
						title,
					},
					visibility: "private",
				},
			});
			await add.mutateAsync({
				path: { collectionId: created.id, targetId },
				body: {
					baseItemsRevisionId: created.latestItemsRevisionId,
				},
			});
			setNewCollectionTitle("");
			newCollectionLanguage.enableAutomaticDetection();
			await invalidateCollections(queryClient, created.id);
		} catch {
			// The typed mutation states supply the visible API error.
		}
	}

	const destinations = collectionListItems(collections).map((collection) => {
		const override = destinationOverrides.get(collection.id);
		return override ? { ...collection, ...override } : collection;
	});
	const listEmptyLabel =
		collections.isPending || me.isPending
			? t.ui.loading
			: deferredDestinationQuery
				? t.collections.save.noMatches
				: t.collections.save.noCollections;
	return (
		<Dialog onOpenChange={({ open: nextOpen }) => updateOpen(nextOpen)} open={open}>
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
			<DialogContent
				className="h-[min(44rem,calc(100svh-2rem))]"
				showCloseButton={false}
				size="sm"
			>
				<DialogHeader
					description={t.collections.save.directDescription}
					title={t.collections.save.title}
				/>
				<div className="flex min-h-0 flex-1 flex-col gap-4 p-(--space) pt-0">
					<div className="grid shrink-0 gap-2">
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
					<CollectionDestinationList
						ariaLabel={t.collections.save.title}
						changingCollectionId={changingCollectionId}
						disabled={pending}
						emptyLabel={listEmptyLabel}
						favoritesLabel={t.collections.favorites}
						hasNextPage={collections.hasNextPage}
						isFetchingNextPage={collections.isFetchingNextPage}
						items={destinations}
						loadingLabel={t.ui.loading}
						nextPageError={collections.isFetchNextPageError ? collections.error : null}
						onLoadNextPage={loadNextPage}
						onToggle={(collection) => void toggleCollection(collection)}
						retryLabel={t.actions.retry}
						targetId={targetId}
						unnamedLabel={t.ui.unnamed}
					/>
					<form
						className="grid shrink-0 gap-2 rounded-xl border border-border-weak p-3"
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
						<DraftContentLanguageField controller={newCollectionLanguage} />
					</form>
					<RequestFailure
						error={
							me.error ??
							(collections.isError && !collections.data ? collections.error : null) ??
							create.error ??
							add.error ??
							remove.error ??
							addFavorite.error ??
							removeFavorite.error
						}
						fallback={t.ui.retryLater}
					/>
				</div>
				<DialogFooter className="justify-between border-t">
					<Button asChild variant="quiet">
						<Link href="/collections">{t.collections.save.manage}</Link>
					</Button>
					<Button onClick={() => updateOpen(false)} variant="secondary">
						{t.collections.close}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
