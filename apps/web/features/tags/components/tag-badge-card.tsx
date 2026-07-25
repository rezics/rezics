"use client";

import {
	Badge,
	Button,
	Popover,
	PopoverBody,
	PopoverClose,
	PopoverContent,
	PopoverDescription,
	PopoverHeader,
	PopoverTitle,
	PopoverTrigger,
	Tooltip,
	TooltipContent,
	TooltipTrigger,
	cn,
} from "@rezics/ui";
import { Check, Info, Search, X } from "lucide-react";
import Link from "next/link";
import { useRef, useState, type MouseEvent } from "react";

import { SignInButton } from "@/features/auth/auth-portal";
import { useTranslation } from "@/i18n/client";
import type { TagPresentation } from "../model/tag-presentation";
import { isModifiedLinkActivation } from "../model/tag-selection";
import { tagDetailHref, tagSearchHref } from "../routing/tag-links";
import { TagVoteControls } from "./tag-vote-controls";

export function TagBadgeCard({
	item,
	label,
	isPending,
	selected,
	selectionMode,
	onClearVote,
	onToggleSelected,
	onVote,
	type,
}: {
	readonly item: TagPresentation;
	readonly label: string;
	readonly isPending: boolean;
	readonly selected: boolean;
	readonly selectionMode: boolean;
	readonly onClearVote: (item: TagPresentation) => void;
	readonly onToggleSelected: (tagId: string) => void;
	readonly onVote: (item: TagPresentation, value: -1 | 1) => void;
	readonly type: "book" | "media" | "software";
}) {
	const { t } = useTranslation(["tags"]);
	const [open, setOpen] = useState(false);
	const nativeNavigation = useRef(false);
	const detailHref = tagDetailHref(item.identity.tagId);
	const score = item.vote.kind === "available" ? item.vote.score : undefined;

	const handleLinkClick = (event: MouseEvent<HTMLAnchorElement>) => {
		if (isModifiedLinkActivation(event)) {
			nativeNavigation.current = true;
			setTimeout(() => {
				nativeNavigation.current = false;
			}, 0);
			return;
		}
		event.preventDefault();
		setOpen((current) => !current);
	};
	const contextLabel =
		item.context.kind === "global"
			? t.tags.card.globalContext
			: item.context.kind === "realm"
				? (item.context.realmTitle ?? t.tags.unnamedRealm)
				: t.tags.card.structureContext;

	return (
		<Badge
			className={cn(
				"max-w-full gap-0 overflow-visible p-0",
				selected && "ring-2 ring-primary/40",
			)}
			pill
			variant={tagBadgeVariant(item)}
		>
			<Popover
				autoFocus={false}
				closeOnEscape
				closeOnInteractOutside
				modal={false}
				onOpenChange={({ open: nextOpen }) => {
					if (nativeNavigation.current) {
						nativeNavigation.current = false;
						return;
					}
					setOpen(nextOpen);
				}}
				open={open}
				positioning={{ placement: "bottom-start", gutter: 8 }}
			>
				<PopoverTrigger asChild>
					<Link
						aria-label={t.tags.card.open({
							tag: label,
							context: contextLabel,
						})}
						className="inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-full px-2.5 py-1.5 outline-none hover:bg-foreground/5 focus-visible:ring-2 focus-visible:ring-ring/40"
						href={detailHref}
						onClick={handleLinkClick}
					>
						<span className="min-w-0 truncate">{label}</span>
						{score === undefined ? null : (
							<span className="shrink-0 tabular-nums text-[0.6875rem] opacity-75">
								{score}
							</span>
						)}
					</Link>
				</PopoverTrigger>
				<PopoverContent className="max-h-[min(32rem,calc(100dvh-2rem))] w-[min(22rem,calc(100vw-2rem))]">
					<PopoverHeader className="pe-12">
						<div className="flex min-w-0 flex-wrap items-center gap-2">
							<div className="flex min-w-0 items-center gap-1">
								<PopoverTitle asChild>
									<Link
										className="min-w-0 truncate rounded-sm outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/40"
										href={detailHref}
									>
										{label}
									</Link>
								</PopoverTitle>
								<Tooltip>
									<TooltipTrigger asChild>
										<span
											aria-label={t.tags.card.details}
											className="inline-flex shrink-0 rounded-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40"
											role="img"
											tabIndex={0}
										>
											<Info aria-hidden className="size-4" />
										</span>
									</TooltipTrigger>
									<TooltipContent>{t.tags.card.details}</TooltipContent>
								</Tooltip>
							</div>
							{item.context.kind === "global" && item.context.pinned ? (
								<Badge variant="secondary">{t.tags.global.pinned}</Badge>
							) : null}
							{item.context.kind === "realm" && item.context.policy ? (
								<Badge variant="secondary">{t.tags.card.policy}</Badge>
							) : null}
						</div>
						<PopoverDescription>{contextLabel}</PopoverDescription>
						<PopoverClose asChild>
							<Button
								aria-label={t.tags.card.close}
								className="absolute end-2 top-2"
								size="icon-sm"
								variant="quiet"
							>
								<X aria-hidden />
							</Button>
						</PopoverClose>
					</PopoverHeader>
					<PopoverBody className="grid gap-4">
						{item.identity.summary ? (
							<p className="line-clamp-3 text-sm leading-6 text-muted-foreground">
								{item.identity.summary}
							</p>
						) : null}
						{item.vote.kind === "available" ? (
							item.vote.canVote ? (
								<TagVoteControls
									canVote
									isPending={isPending}
									onClear={() => onClearVote(item)}
									onVote={(value) => onVote(item, value)}
									score={item.vote.score}
									viewerVote={item.vote.viewerVote}
									voteCount={item.vote.voteCount}
								/>
							) : item.vote.unavailableReason === "signed-out" ? (
								<div className="grid gap-2">
									<p className="text-xs text-muted-foreground">
										{t.tags.vote.signInDescription}
									</p>
									<SignInButton className="w-fit" size="sm" variant="outline">
										{t.tags.vote.signIn}
									</SignInButton>
								</div>
							) : (
								<div className="grid gap-1">
									<p className="text-xs text-muted-foreground">
										{t.tags.vote.summary({
											score: String(item.vote.score),
											count: String(item.vote.voteCount),
										})}
									</p>
									<p className="text-xs text-muted-foreground">
										{t.tags.realms.cannotVote}
									</p>
								</div>
							)
						) : null}
						<div className="flex flex-wrap items-center gap-1 border-t border-border-weak pt-2">
							<Button asChild className="w-fit" size="sm" variant="quiet">
								<Link
									href={tagSearchHref(type, [
										{ tagId: item.identity.tagId, label },
									])}
								>
									<Search aria-hidden />
									<span className="truncate">{t.tags.card.search}</span>
								</Link>
							</Button>
							{/* Tag details are available from the linked title above.
							<Button asChild className="min-w-0" size="sm" variant="outline">
								<Link href={detailHref}>
									<Info aria-hidden />
									<span className="truncate">{t.tags.card.details}</span>
								</Link>
							</Button>
							*/}
							{item.context.kind === "realm" && item.context.contextPostId ? (
								<Button asChild className="w-fit" size="sm" variant="quiet">
									<Link href={`/posts/${item.context.contextPostId}`}>
										{t.tags.realms.context}
									</Link>
								</Button>
							) : null}
							{/* Temporarily hidden while selection remains available from selection mode.
							<Button
								aria-pressed={selected}
								className="col-span-2 min-w-0"
								onClick={() => onToggleSelected(item.identity.tagId)}
								size="sm"
								variant={selected ? "secondary" : "outline"}
							>
								<Check aria-hidden />
								{selected ? t.tags.selection.remove : t.tags.selection.add}
							</Button>
							*/}
						</div>
					</PopoverBody>
				</PopoverContent>
			</Popover>
			{selectionMode ? (
				<button
					aria-label={
						selected
							? t.tags.selection.removeNamed({ tag: label })
							: t.tags.selection.addNamed({ tag: label })
					}
					aria-pressed={selected}
					className="me-1 inline-grid size-6 shrink-0 place-items-center rounded-full border border-current/20 bg-background/60 outline-none hover:bg-background focus-visible:ring-2 focus-visible:ring-ring/40"
					onClick={() => onToggleSelected(item.identity.tagId)}
					type="button"
				>
					{selected ? <Check aria-hidden className="size-3.5" /> : null}
				</button>
			) : null}
		</Badge>
	);
}

function tagBadgeVariant(
	item: TagPresentation,
): "default" | "secondary" | "outline" | "success" | "destructive" {
	if (item.vote.kind === "available" && item.vote.viewerVote === 1) return "success";
	if (item.vote.kind === "available" && item.vote.viewerVote === -1) return "destructive";
	if (item.context.kind === "realm" && item.context.policy) return "secondary";
	return "outline";
}
