"use client";

import {
	getApiReactionsUnitsByUnitIdQueryKey,
	useDeleteApiReactionsUnitsByUnitId,
	useGetApiReactionsUnitsByUnitId,
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
	LinkIcon,
	MessageCircleIcon,
	Share2Icon,
} from "lucide-react";
import { AppLink as Link } from "@/features/application-shell/components/app-link";
import { useState, type ReactNode } from "react";

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
	cn,
} from "@rezics/ui";
import { useAuthPortal } from "@/features/auth/auth-portal-context";
import {
	UnitReportDialog,
	UnitReportMenuItem,
	type UnitReportTarget,
} from "@/features/reports/components/unit-report-dialog";
import { CollectionPickerButton } from "@/features/collections/components/collection-picker-button";
import { FollowButton } from "@/features/following/components/follow-button";
import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import { toNonNegativeApiInteger } from "@/lib/api-number";
import { useHydratedSession } from "@/lib/use-hydrated-session";
import type { FeedActionPolicy } from "../model/feed-action-policy";
import { getFeedReactionScore, parseFeedReaction, type FeedReaction } from "../model/feed-reaction";

export type { FeedReaction } from "../model/feed-reaction";

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
		<ButtonGroup
			aria-label={t.feed.actions.voteGroup}
			className="rounded-lg bg-secondary text-secondary-foreground"
		>
			<Button
				aria-label={t.engagement.upvote}
				aria-pressed={reaction === "upvote"}
				className={cn(
					"border-0",
					reaction === "upvote" && "text-primary hover:text-primary",
				)}
				disabled={disabled}
				onClick={() => onReactionChange(reaction === "upvote" ? null : "upvote")}
				size="icon-md"
				variant="quiet"
			>
				<ArrowBigUpIcon
					aria-hidden
					fill={reaction === "upvote" ? "currentColor" : "none"}
				/>
			</Button>
			<ButtonGroupText
				aria-live="polite"
				className={cn(
					"min-w-9 justify-center border-0 bg-transparent px-1 text-xs shadow-none",
					reaction === "upvote" && "text-primary",
					reaction === "downvote" && "text-info",
				)}
			>
				{score}
			</ButtonGroupText>
			<Button
				aria-label={t.engagement.downvote}
				aria-pressed={reaction === "downvote"}
				className={cn("border-0", reaction === "downvote" && "text-info hover:text-info")}
				disabled={disabled}
				onClick={() => onReactionChange(reaction === "downvote" ? null : "downvote")}
				size="icon-md"
				variant="quiet"
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
	actions,
	href,
	initialReaction,
	itemId,
	onCommentsClick,
	overflowMenu,
	policy,
	reactionDisabled = false,
	realmId,
	replyCount = 0,
	score,
	showErrors = true,
}: {
	actions?: ReactNode;
	href?: string;
	initialReaction: FeedReaction;
	itemId: string;
	onCommentsClick?: () => void;
	overflowMenu?: ReactNode;
	policy: FeedActionPolicy;
	reactionDisabled?: boolean;
	realmId?: string;
	replyCount?: number;
	score: number;
	showErrors?: boolean;
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
			<div className="flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
				<FeedVoteControl
					disabled={pending || reactionDisabled}
					onReactionChange={(next) => void changeReaction(next)}
					reaction={reaction}
					score={formattedScore}
				/>
				{policy.comments && href ? (
					<Button asChild className="min-h-8" size="sm" variant="secondary">
						<Link href={href} onClick={onCommentsClick}>
							<MessageCircleIcon aria-hidden data-icon="inline-start" />
							{t.feed.actions.comments({ count: replyCount })}
						</Link>
					</Button>
				) : null}
				{policy.primary === "collect" ? (
					<CollectionPickerButton
						targetId={itemId}
						triggerClassName="min-h-8"
						triggerVariant="secondary"
					/>
				) : null}
				{policy.primary === "follow" ? (
					<FollowButton
						className="min-h-8"
						size="sm"
						unitId={itemId}
						variant="secondary"
					/>
				) : null}
				{actions}
				<FeedShareSurface href={href} itemId={itemId} />
				{overflowMenu}
			</div>
			{showErrors ? (
				<RequestFailure
					error={putReaction.error ?? deleteReaction.error}
					fallback={t.ui.retryLater}
				/>
			) : null}
		</div>
	);
}

export function ConnectedFeedEngagementBar({
	actions,
	href,
	itemId,
	overflowMenu,
	policy,
	realmId,
	replyCount = 0,
	showErrors = true,
}: {
	readonly actions?: ReactNode;
	readonly href?: string;
	readonly itemId: string;
	readonly overflowMenu?: ReactNode;
	readonly policy: FeedActionPolicy;
	readonly realmId?: string;
	readonly replyCount?: number;
	readonly showErrors?: boolean;
}) {
	const reactions = useGetApiReactionsUnitsByUnitId({
		path: { unitId: itemId },
		query: { ...(realmId ? { realmId } : {}) },
	});
	const counts = new Map(
		reactions.data?.items.map(({ count, reaction }) => [
			reaction,
			toNonNegativeApiInteger(count),
		]) ?? [],
	);
	return (
		<>
			<FeedEngagementBar
				actions={actions}
				href={href}
				initialReaction={parseFeedReaction(reactions.data?.viewerReaction)}
				itemId={itemId}
				overflowMenu={overflowMenu}
				policy={policy}
				reactionDisabled={reactions.isError}
				realmId={realmId}
				replyCount={replyCount}
				score={(counts.get("upvote") ?? 0) - (counts.get("downvote") ?? 0)}
				showErrors={showErrors}
			/>
			{showErrors ? <RequestFailure error={reactions.error} /> : null}
		</>
	);
}

export function FeedOverflowMenu({
	canExclude,
	children,
	itemId,
	onNotInterested,
	reportTarget,
}: {
	canExclude: boolean;
	children?: ReactNode;
	itemId: string;
	onNotInterested?: () => void;
	reportTarget?: UnitReportTarget;
}) {
	const { data: session } = useHydratedSession();
	const { openAuthPortal } = useAuthPortal();
	const [collectionOpen, setCollectionOpen] = useState(false);
	const [reportOpen, setReportOpen] = useState(false);
	const openCollectionPicker = () => {
		if (session) setCollectionOpen(true);
		else openAuthPortal("login");
	};
	const openReport = () => {
		if (session) setReportOpen(true);
		else openAuthPortal("login");
	};

	return (
		<>
			<FeedOverflowMenuView
				canExclude={canExclude}
				onNotInterested={onNotInterested}
				onSave={openCollectionPicker}
			>
				{reportTarget ? <UnitReportMenuItem onSelect={openReport} /> : null}
				{children}
			</FeedOverflowMenuView>
			<CollectionPickerButton
				onOpenChange={setCollectionOpen}
				open={collectionOpen}
				targetId={itemId}
			/>
			{reportTarget ? (
				<UnitReportDialog
					onOpenChange={setReportOpen}
					open={reportOpen}
					realmId={reportTarget.realmId}
					unitId={reportTarget.unitId}
				/>
			) : null}
		</>
	);
}

export function FeedOverflowMenuView({
	canExclude,
	children,
	onNotInterested,
	onSave,
}: {
	canExclude: boolean;
	children?: ReactNode;
	onNotInterested?: () => void;
	onSave: () => void;
}) {
	const { t } = useTranslation(["collections", "feed"]);
	return (
		<Menu>
			<MenuTrigger asChild>
				<Button
					aria-label={t.feed.moreActions}
					className="data-[state=open]:bg-accent"
					pill
					size="icon-md"
					variant="quiet"
				>
					<EllipsisIcon aria-hidden />
				</Button>
			</MenuTrigger>
			<MenuContent>
				<MenuItem onSelect={onSave} value="save">
					<BookmarkIcon aria-hidden />
					{t.collections.save.action}
				</MenuItem>
				{canExclude && onNotInterested ? (
					<MenuItem onSelect={onNotInterested} value="not-interested">
						<EyeOffIcon aria-hidden />
						{t.feed.notInterested}
					</MenuItem>
				) : null}
				{children}
			</MenuContent>
		</Menu>
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
				className="min-h-8"
				onClick={() => setOpen(true)}
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
