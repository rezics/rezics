"use client";

import {
	getApiCollectionsByCollectionIdQueryKey,
	getApiCollectionsQueryKey,
	useDeleteApiCollectionsByCollectionIdItemsByTargetId,
	useGetApiCollections,
	useGetApiUsersMe,
	usePutApiCollectionsByCollectionIdItemsByTargetId,
} from "@rezics/openapi-tanstack-query";
import { useQueryClient } from "@tanstack/react-query";
import { CheckIcon, LibraryIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Button, Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from "@rezics/ui";
import { useAuthPortal } from "@/features/auth/auth-portal";
import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import { useHydratedSession } from "@/lib/use-hydrated-session";

export function CollectionPickerButton({
	onOpenChange,
	open: controlledOpen,
	targetId,
	triggerClassName,
	triggerVariant,
}: {
	onOpenChange?: (open: boolean) => void;
	open?: boolean;
	targetId: string;
	triggerClassName?: string;
	triggerVariant?: "outline" | "secondary";
}) {
	const { t } = useTranslation(["engagement", "feed", "ui"]);
	const { data: session } = useHydratedSession();
	const { openAuthPortal } = useAuthPortal();
	const queryClient = useQueryClient();
	const [internalOpen, setInternalOpen] = useState(false);
	const open = controlledOpen ?? internalOpen;
	const setOpen = onOpenChange ?? setInternalOpen;
	const me = useGetApiUsersMe({ query: { enabled: open && Boolean(session) } });
	const collections = useGetApiCollections(
		{
			query: {
				...(me.data?.id ? { ownerId: me.data.id } : {}),
				targetId,
				limit: 50,
			},
		},
		{ query: { enabled: open && Boolean(me.data?.id) } },
	);
	const add = usePutApiCollectionsByCollectionIdItemsByTargetId();
	const remove = useDeleteApiCollectionsByCollectionIdItemsByTargetId();
	const [changingCollectionId, setChangingCollectionId] = useState<string>();

	function requestOpen() {
		if (!session) openAuthPortal("login");
		else setOpen(true);
	}

	async function toggleCollection(collectionId: string, containsTarget: boolean) {
		setChangingCollectionId(collectionId);
		try {
			if (containsTarget) await remove.mutateAsync({ path: { collectionId, targetId } });
			else
				await add.mutateAsync({
					path: { collectionId, targetId },
					body: { kind: "item" },
				});
			await Promise.all([
				queryClient.invalidateQueries({ queryKey: getApiCollectionsQueryKey() }),
				queryClient.invalidateQueries({
					queryKey: getApiCollectionsByCollectionIdQueryKey({
						path: { collectionId },
					}),
				}),
			]);
		} catch {
			// The query and mutation retain the last confirmed server state.
		} finally {
			setChangingCollectionId(undefined);
		}
	}

	return (
		<Dialog onOpenChange={({ open: nextOpen }) => setOpen(nextOpen)} open={open}>
			{triggerVariant ? (
				<Button
					className={triggerClassName}
					onClick={requestOpen}
					size="sm"
					variant={triggerVariant}
				>
					<LibraryIcon aria-hidden data-icon="inline-start" />
					{t.feed.actions.addToCollection}
				</Button>
			) : null}
			<DialogContent showCloseButton={false} size="sm">
				<DialogHeader
					description={t.engagement.directCollectionHint}
					title={t.feed.actions.collectionPickerTitle}
				/>
				<DialogBody className="grid gap-2">
					{collections.isPending || me.isPending ? (
						<p className="text-sm text-muted-foreground">{t.ui.loading}</p>
					) : collections.data?.items.length ? (
						collections.data.items.map((collection) => {
							const selfReference = collection.id === targetId;
							return (
								<Button
									aria-pressed={collection.containsTarget}
									className="h-auto min-h-11 justify-between whitespace-normal py-2 text-start"
									disabled={
										selfReference ||
										add.isPending ||
										remove.isPending ||
										changingCollectionId === collection.id
									}
									key={collection.id}
									onClick={() =>
										void toggleCollection(
											collection.id,
											collection.containsTarget,
										)
									}
									variant={collection.containsTarget ? "secondary" : "outline"}
								>
									<span>{collection.title ?? t.ui.unnamed}</span>
									{collection.containsTarget ? <CheckIcon aria-hidden /> : null}
								</Button>
							);
						})
					) : (
						<p className="text-sm text-muted-foreground">
							{t.feed.actions.noOwnedCollections}
						</p>
					)}
					<RequestFailure
						error={me.error ?? collections.error ?? add.error ?? remove.error}
						fallback={t.ui.retryLater}
					/>
				</DialogBody>
				<DialogFooter className="justify-between border-t">
					<Button asChild variant="quiet">
						<Link href="/collections">{t.feed.actions.manageCollections}</Link>
					</Button>
					<Button onClick={() => setOpen(false)} variant="secondary">
						{t.engagement.cancel}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
