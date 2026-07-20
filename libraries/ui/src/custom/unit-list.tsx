"use client";

import { BookOpenIcon } from "lucide-react";

import { useUiMessages } from "./ui-provider";
import { Cover } from "./cover";
import { Alert, AlertDescription } from "../ui/alert";
import { Item, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from "../ui/item";
import { LinkBox, LinkOverlay } from "../ui/link-overlay";
import { Skeleton } from "../ui/skeleton";

export interface UnitListItem {
	id: string;
	title: string | null;
	summary?: string | null;
	href?: string;
	avatar?: { id: string; url: string } | null;
	cover?: { id: string; url: string } | null;
}

export function UnitList({
	items,
	pending,
	error,
	href,
	variant = "list",
}: {
	items: readonly UnitListItem[] | undefined;
	pending: boolean;
	error: boolean;
	href?: (item: UnitListItem) => string | undefined;
	variant?: "list" | "shelf";
}) {
	const messages = useUiMessages();
	if (pending)
		return (
			<div
				className={
					variant === "shelf"
						? "grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 lg:grid-cols-5"
						: "grid gap-3"
				}
			>
				{Array.from({ length: variant === "shelf" ? 10 : 4 }, (_, index) => (
					<Skeleton
						key={index}
						className={
							variant === "shelf" ? "aspect-[3/4] rounded-xl" : "h-24 rounded-xl"
						}
					/>
				))}
			</div>
		);
	if (error)
		return (
			<Alert variant="destructive">
				<AlertDescription>{messages.error}</AlertDescription>
			</Alert>
		);
	if (!items?.length) return <p className="text-muted-foreground text-sm">{messages.empty}</p>;
	if (variant === "shelf")
		return (
			<div
				className="grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 lg:grid-cols-5"
				role="list"
			>
				{items.map((item) => {
					const target = href?.(item) ?? item.href;
					const title =
						item.title ??
						(typeof messages.unnamed === "string" ? messages.unnamed : "Unnamed");
					return (
						<LinkBox className="group min-w-0" key={item.id} role="listitem">
							<Cover
								alt={title}
								className="rounded-xl border border-border-weak shadow-sm/5 transition-transform duration-200 group-hover:-translate-y-0.5 motion-reduce:transition-none"
								fallback={<BookOpenIcon aria-hidden className="size-8" />}
								sizes="(min-width: 1024px) 176px, (min-width: 640px) 28vw, 44vw"
								src={item.cover?.url}
							/>
							<h2 className="mt-2.5 line-clamp-2 font-semibold text-sm leading-5">
								{target ? <LinkOverlay href={target}>{title}</LinkOverlay> : title}
							</h2>
							{item.summary ? (
								<p className="mt-1 line-clamp-2 text-muted-foreground text-xs leading-5">
									{item.summary}
								</p>
							) : null}
						</LinkBox>
					);
				})}
			</div>
		);

	return (
		<ItemGroup className="gap-0 overflow-hidden rounded-2xl bg-background">
			{items.map((item) => {
				const target = href?.(item) ?? item.href;
				const usesAvatar = Boolean(item.avatar);
				const title =
					item.title ??
					(typeof messages.unnamed === "string" ? messages.unnamed : "Unnamed");
				return (
					<LinkBox key={item.id}>
						<Item
							className="rounded-none border-0 border-b border-border-weak shadow-none last:border-b-0 hover:bg-surface-hover focus-within:bg-surface-hover"
							role="listitem"
						>
							{usesAvatar ? (
								<ItemMedia
									className="bg-accent text-accent-foreground size-14 overflow-hidden rounded-full text-lg font-black"
									variant="image"
								>
									{item.avatar ? (
										<img
											alt=""
											className="size-full object-cover"
											src={item.avatar.url}
										/>
									) : (
										(item.title ?? "R").slice(0, 1)
									)}
								</ItemMedia>
							) : (
								<Cover
									alt={title}
									className="w-14 shrink-0 self-stretch rounded-md"
									fallback={<BookOpenIcon aria-hidden className="size-5" />}
									src={item.cover?.url}
								/>
							)}
							<ItemContent className="min-w-0 justify-center">
								<ItemTitle>
									{target ? (
										<LinkOverlay href={target}>
											{item.title ?? messages.unnamed}
										</LinkOverlay>
									) : (
										(item.title ?? messages.unnamed)
									)}
								</ItemTitle>
								{item.summary && <ItemDescription>{item.summary}</ItemDescription>}
							</ItemContent>
						</Item>
					</LinkBox>
				);
			})}
		</ItemGroup>
	);
}
