"use client";

import {
	getApiCollectionsFavoritesQueryKey,
	getApiCollectionsQueryKey,
	getApiReactionsUnitsByUnitIdQueryKey,
	useDeleteApiCollectionsFavoritesItemsByTargetId,
	useDeleteApiReactionsUnitsByUnitId,
	useGetApiCollections,
	useGetApiCollectionsFavorites,
	useGetApiUsersMe,
	usePutApiCollectionsByCollectionIdItemsByTargetId,
	usePutApiCollectionsFavoritesItemsByTargetId,
	usePutApiReactionsSharesByUnitId,
	usePutApiReactionsUnitsByUnitId,
} from "@rezics/openapi-tanstack-query";
import { useQueryClient } from "@tanstack/react-query";
import {
	ArrowBigDownIcon,
	ArrowBigUpIcon,
	BookmarkIcon,
	CheckIcon,
	EllipsisIcon,
	EyeOffIcon,
	LibraryIcon,
	LinkIcon,
	MessageCircleIcon,
	Share2Icon,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import {
	Button,
	ButtonGroup,
	ButtonGroupText,
	Dialog,
	DialogBody,
	DialogContent,
	DialogFooter,
	DialogHeader,
	Menu,
	MenuContent,
	MenuItem,
	MenuTrigger,
} from "@rezics/ui";
import { useAuthPortal } from "@/features/auth/auth-portal";
import { FollowButton } from "@/features/following/components/follow-button";
import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import { useHydratedSession } from "@/lib/use-hydrated-session";
import type { FeedActionPolicy } from "./feed-action-policy";
import { getFeedReactionScore, type FeedReaction } from "./feed-reaction";

export type { FeedReaction } from "./feed-reaction";

export function FeedVoteControl({
	disabled = false,
	onReactionChange,
	reaction,
	score,
}: {
	disabled?: boolean;
	onReactionChange: (reaction: FeedReaction) => void;
	reaction: FeedReaction;
	score: string;
}) {
	const { t } = useTranslation(["engagement", "feed"]);
	return (
		<ButtonGroup aria-label={t.feed.actions.voteGroup} className="rounded-full bg-muted">
			<Button
				aria-label={t.engagement.upvote}
				aria-pressed={reaction === "upvote"}
				className="size-11 rounded-full border-0 sm:size-8"
				disabled={disabled}
				onClick={() => onReactionChange(reaction === "upvote" ? null : "upvote")}
				size="icon-md"
				variant={reaction === "upvote" ? "brand" : "quiet"}
			>
				<ArrowBigUpIcon
					aria-hidden
					fill={reaction === "upvote" ? "currentColor" : "none"}
				/>
			</Button>
			<ButtonGroupText
				aria-live="polite"
				className="min-w-9 justify-center border-0 bg-transparent px-1 text-xs shadow-none"
			>
				{score}
			</ButtonGroupText>
			<Button
				aria-label={t.engagement.downvote}
				aria-pressed={reaction === "downvote"}
				className="size-11 rounded-full border-0 sm:size-8"
				disabled={disabled}
				onClick={() => onReactionChange(reaction === "downvote" ? null : "downvote")}
				size="icon-md"
				variant={reaction === "downvote" ? "brand" : "quiet"}
			>
				<ArrowBigDownIcon
					aria-hidden
					fill={reaction === "downvote" ? "currentColor" : "none"}
				/>
			</Button>
		</ButtonGroup>
	);
}

export function FeedEngagementBar({
	href,
	initialReaction,
	itemId,
	onCommentsClick,
	policy,
	realmId,
	replyCount = 0,
	score,
}: {
	href?: string;
	initialReaction: FeedReaction;
	itemId: string;
	onCommentsClick?: () => void;
	policy: FeedActionPolicy;
	realmId?: string;
	replyCount?: number;
	score: number;
}) {
	const { locale, t } = useTranslation(["feed", "ui"]);
	const { data: session } = useHydratedSession();
	const { openAuthPortal } = useAuthPortal();
	const queryClient = useQueryClient();
	const [reactionOverride, setReactionOverride] = useState<FeedReaction>();
	const reaction = reactionOverride === undefined ? initialReaction : reactionOverride;
	const putReaction = usePutApiReactionsUnitsByUnitId();
	const deleteReaction = useDeleteApiReactionsUnitsByUnitId();
	const pending = putReaction.isPending || deleteReaction.isPending;
	const displayedScore = getFeedReactionScore({
		current: reaction,
		initial: initialReaction,
		score,
	});
	const formattedScore = new Intl.NumberFormat(locale.target, {
		notation: "compact",
		maximumFractionDigits: 1,
	}).format(displayedScore);

	async function changeReaction(next: FeedReaction) {
		if (!session) {
			openAuthPortal("login");
			return;
		}
		const previous = reaction;
		setReactionOverride(next);
		try {
			if (next === null) {
				if (previous === null) return;
				await deleteReaction.mutateAsync({
					path: { unitId: itemId },
					body: { reaction: previous, ...(realmId ? { realmId } : {}) },
				});
			} else {
				await putReaction.mutateAsync({
					path: { unitId: itemId },
					body: { reaction: next, ...(realmId ? { realmId } : {}) },
				});
			}
			await queryClient.invalidateQueries({
				queryKey: getApiReactionsUnitsByUnitIdQueryKey({ path: { unitId: itemId } }),
			});
		} catch {
			setReactionOverride(previous);
		}
	}

	return (
		<div className="mt-3 grid gap-1 pt-1">
			<div className="flex items-center gap-1.5 overflow-x-auto">
				<FeedVoteControl
					disabled={pending}
					onReactionChange={(next) => void changeReaction(next)}
					reaction={reaction}
					score={formattedScore}
				/>
				{policy.comments && href ? (
					<Button
						asChild
						className="min-h-11 sm:min-h-8"
						pill
						size="sm"
						variant="secondary"
					>
						<Link href={href} onClick={onCommentsClick}>
							<MessageCircleIcon aria-hidden data-icon="inline-start" />
							{t.feed.actions.comments({ count: replyCount })}
						</Link>
					</Button>
				) : null}
				{policy.primary === "collect" ? (
					<CollectionPicker itemId={itemId} triggerVariant="secondary" />
				) : null}
				{policy.primary === "follow" ? (
					<FollowButton
						className="min-h-11 sm:min-h-8"
						pill
						size="sm"
						unitId={itemId}
						variant="secondary"
					/>
				) : null}
				<FeedShareSurface href={href} itemId={itemId} />
			</div>
			<RequestFailure
				error={putReaction.error ?? deleteReaction.error}
				fallback={t.ui.retryLater}
			/>
		</div>
	);
}

export function FeedOverflowMenu({
	canExclude,
	itemId,
	onNotInterested,
}: {
	canExclude: boolean;
	itemId: string;
	onNotInterested?: () => void;
}) {
	const { data: session } = useHydratedSession();
	const { openAuthPortal } = useAuthPortal();
	const queryClient = useQueryClient();
	const [collectionOpen, setCollectionOpen] = useState(false);
	const favorites = useGetApiCollectionsFavorites({ query: { enabled: Boolean(session) } });
	const addFavorite = usePutApiCollectionsFavoritesItemsByTargetId();
	const removeFavorite = useDeleteApiCollectionsFavoritesItemsByTargetId();
	const saved = favorites.data?.items.some((item) => item.targetId === itemId) ?? false;

	async function toggleSaved() {
		if (!session) {
			openAuthPortal("login");
			return;
		}
		try {
			if (saved) await removeFavorite.mutateAsync({ path: { targetId: itemId } });
			else await addFavorite.mutateAsync({ path: { targetId: itemId } });
			await queryClient.invalidateQueries({ queryKey: getApiCollectionsFavoritesQueryKey() });
		} catch {
			// The query and mutation retain the last confirmed server state.
		}
	}
	function openCollectionPicker() {
		if (!session) openAuthPortal("login");
		else setCollectionOpen(true);
	}

	return (
		<>
			<FeedOverflowMenuView
				canExclude={canExclude}
				onAddToCollection={openCollectionPicker}
				onNotInterested={onNotInterested}
				onToggleSaved={() => void toggleSaved()}
				savePending={addFavorite.isPending || removeFavorite.isPending}
				saved={saved}
			/>
			<CollectionPicker
				itemId={itemId}
				onOpenChange={setCollectionOpen}
				open={collectionOpen}
			/>
		</>
	);
}

export function FeedOverflowMenuView({
	canExclude,
	onAddToCollection,
	onNotInterested,
	onToggleSaved,
	savePending = false,
	saved,
}: {
	canExclude: boolean;
	onAddToCollection: () => void;
	onNotInterested?: () => void;
	onToggleSaved: () => void;
	savePending?: boolean;
	saved: boolean;
}) {
	const { t } = useTranslation(["feed", "ui"]);
	return (
		<Menu>
			<MenuTrigger asChild>
				<Button
					aria-label={t.feed.moreActions}
					className="ms-auto size-11 rounded-full data-[state=open]:bg-accent sm:size-8"
					size="icon-md"
					variant="quiet"
				>
					<EllipsisIcon aria-hidden />
				</Button>
			</MenuTrigger>
			<MenuContent>
				<MenuItem disabled={savePending} onSelect={onToggleSaved} value="save">
					<BookmarkIcon aria-hidden fill={saved ? "currentColor" : "none"} />
					{saved ? t.feed.actions.saved : t.ui.save}
				</MenuItem>
				<MenuItem onSelect={onAddToCollection} value="add-to-collection">
					<LibraryIcon aria-hidden />
					{t.feed.actions.addToCollection}
				</MenuItem>
				{canExclude && onNotInterested ? (
					<MenuItem onSelect={onNotInterested} value="not-interested">
						<EyeOffIcon aria-hidden />
						{t.feed.notInterested}
					</MenuItem>
				) : null}
			</MenuContent>
		</Menu>
	);
}

function CollectionPicker({
	itemId,
	onOpenChange,
	open: controlledOpen,
	triggerVariant,
}: {
	itemId: string;
	onOpenChange?: (open: boolean) => void;
	open?: boolean;
	triggerVariant?: "secondary";
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
		{ query: { ...(me.data?.id ? { ownerId: me.data.id } : {}), limit: 50 } },
		{ query: { enabled: open && Boolean(me.data?.id) } },
	);
	const add = usePutApiCollectionsByCollectionIdItemsByTargetId();
	const [addedCollectionId, setAddedCollectionId] = useState<string>();

	function requestOpen() {
		if (!session) openAuthPortal("login");
		else setOpen(true);
	}

	async function addToCollection(collectionId: string) {
		try {
			await add.mutateAsync({
				path: { collectionId, targetId: itemId },
				body: { kind: "item" },
			});
			setAddedCollectionId(collectionId);
			await queryClient.invalidateQueries({ queryKey: getApiCollectionsQueryKey() });
		} catch {
			// The mutation error is rendered in the dialog.
		}
	}

	return (
		<Dialog onOpenChange={({ open: nextOpen }) => setOpen(nextOpen)} open={open}>
			{triggerVariant ? (
				<Button
					className="min-h-11 sm:min-h-8"
					onClick={requestOpen}
					pill
					size="sm"
					variant={triggerVariant}
				>
					<LibraryIcon aria-hidden data-icon="inline-start" />
					{t.feed.actions.addToCollection}
				</Button>
			) : null}
			<DialogContent showCloseButton={false} size="sm">
				<DialogHeader
					description={t.feed.actions.collectionPickerDescription}
					title={t.feed.actions.collectionPickerTitle}
				/>
				<DialogBody className="grid gap-2">
					{collections.isPending || me.isPending ? (
						<p className="text-muted-foreground text-sm">{t.ui.loading}</p>
					) : collections.data?.items.length ? (
						collections.data.items.map((collection) => (
							<Button
								className="h-auto min-h-11 justify-between whitespace-normal py-2 text-start"
								disabled={add.isPending || addedCollectionId === collection.id}
								key={collection.id}
								onClick={() => void addToCollection(collection.id)}
								variant="outline"
							>
								<span>{collection.title ?? t.ui.unnamed}</span>
								{addedCollectionId === collection.id ? (
									<CheckIcon aria-hidden />
								) : null}
							</Button>
						))
					) : (
						<p className="text-muted-foreground text-sm">
							{t.feed.actions.noOwnedCollections}
						</p>
					)}
					<RequestFailure
						error={me.error ?? collections.error ?? add.error}
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

function FeedShareSurface({ href, itemId }: { href?: string; itemId: string }) {
	const { data: session } = useHydratedSession();
	const recordShare = usePutApiReactionsSharesByUnitId();

	function shareUrl(): string {
		if (!href) return typeof window === "undefined" ? "" : window.location.href;
		if (typeof window === "undefined") return href;
		return new URL(href, window.location.origin).href;
	}

	function record() {
		if (session) recordShare.mutate({ path: { unitId: itemId } });
	}

	async function nativeShare(): Promise<boolean> {
		try {
			await navigator.share({ url: shareUrl() });
			record();
			return true;
		} catch (error) {
			if (error instanceof DOMException && error.name === "AbortError") return false;
			throw error;
		}
	}

	async function copyLink() {
		await navigator.clipboard.writeText(shareUrl());
		record();
	}

	return (
		<FeedShareSurfaceView
			nativeShareAvailable={typeof navigator !== "undefined" && "share" in navigator}
			onCopyLink={copyLink}
			onNativeShare={nativeShare}
		/>
	);
}

export function FeedShareSurfaceView({
	nativeShareAvailable,
	onCopyLink,
	onNativeShare,
}: {
	nativeShareAvailable: boolean;
	onCopyLink: () => Promise<void>;
	onNativeShare: () => Promise<boolean>;
}) {
	const { t } = useTranslation(["engagement", "feed"]);
	const [open, setOpen] = useState(false);
	const [status, setStatus] = useState<"copied" | "error" | null>(null);

	async function shareNative() {
		try {
			if (await onNativeShare()) setOpen(false);
		} catch {
			setStatus("error");
		}
	}

	async function copyLink() {
		try {
			await onCopyLink();
			setStatus("copied");
		} catch {
			setStatus("error");
		}
	}

	return (
		<Dialog
			onOpenChange={({ open: nextOpen }) => {
				setOpen(nextOpen);
				if (nextOpen) setStatus(null);
			}}
			open={open}
		>
			<Button
				aria-label={t.feed.actions.shareTitle}
				className="min-h-11 sm:min-h-8"
				onClick={() => setOpen(true)}
				pill
				size="sm"
				variant="secondary"
			>
				<Share2Icon aria-hidden data-icon="inline-start" />
				<span className="hidden sm:inline">{t.feed.actions.shareTitle}</span>
			</Button>
			<DialogContent showCloseButton={false} size="sm">
				<DialogHeader
					description={t.feed.actions.shareDescription}
					title={t.feed.actions.shareTitle}
				/>
				<DialogBody className="grid gap-2">
					{nativeShareAvailable ? (
						<Button onClick={() => void shareNative()} variant="outline">
							<Share2Icon aria-hidden data-icon="inline-start" />
							{t.feed.actions.shareNative}
						</Button>
					) : null}
					<Button onClick={() => void copyLink()} variant="outline">
						{status === "copied" ? (
							<CheckIcon aria-hidden data-icon="inline-start" />
						) : (
							<LinkIcon aria-hidden data-icon="inline-start" />
						)}
						{status === "copied" ? t.feed.actions.linkCopied : t.feed.actions.copyLink}
					</Button>
					{status === "error" ? (
						<p className="text-destructive text-sm" role="alert">
							{t.feed.actions.shareFailed}
						</p>
					) : null}
				</DialogBody>
				<DialogFooter className="border-t">
					<Button onClick={() => setOpen(false)} variant="secondary">
						{t.engagement.cancel}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
