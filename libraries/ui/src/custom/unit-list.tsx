"use client";

import { BookOpenIcon } from "lucide-react";
import type { PresentedAvatar } from "@rezics/avatar";

import { useUiMessages } from "./ui-provider";
import { UnitCard } from "./unit-card";
import { Cover } from "./cover";
import { Alert, AlertDescription } from "../ui/alert";
import { Item, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from "../ui/item";
import { LinkBox, LinkOverlay } from "../ui/link-overlay";
import { Skeleton } from "../ui/skeleton";
import { IdentityAvatar } from "./identity-avatar";

export interface UnitListItem {
	id: string;
	title: string | null;
	summary?: string | null;
	href?: string;
	avatar?: PresentedAvatar | null;
	cover?: { id: string; url: string } | null;
}

interface UnitListStateProps {
	items: readonly UnitListItem[] | undefined;
	pending: boolean;
	error: boolean;
}

type UnitListProps =
	| (UnitListStateProps & {
			href: (item: UnitListItem) => string;
			variant: "shelf";
	  })
	| (UnitListStateProps & {
			href?: (item: UnitListItem) => string | undefined;
			variant?: "list";
	  });

export function UnitList(props: UnitListProps) {
	const { items, pending, error } = props;
	const variant = props.variant ?? "list";
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
	if (props.variant === "shelf")
		return (
			<div
				className="grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 lg:grid-cols-5"
				role="list"
			>
				{items.map((item) => {
					const title =
						item.title ??
						(typeof messages.unnamed === "string" ? messages.unnamed : "Unnamed");
					return (
						<div key={item.id} role="listitem">
							<UnitCard
								cover={item.cover}
								description={item.summary}
								fallback={<BookOpenIcon aria-hidden className="size-8" />}
								href={props.href(item)}
								title={title}
							/>
						</div>
					);
				})}
			</div>
		);

	return (
		<ItemGroup className="gap-0 overflow-hidden rounded-2xl bg-background">
			{items.map((item) => {
				const target = props.href?.(item) ?? item.href;
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
								<ItemMedia variant="icon">
									<IdentityAvatar
										avatar={item.avatar}
										className="size-14 text-lg font-black"
										fallback={(item.title ?? "R").slice(0, 1)}
									/>
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
