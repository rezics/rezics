"use client";

import { useUiMessages } from "./ui-provider";
import { Alert, AlertDescription } from "../ui/alert";
import { Item, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from "../ui/item";
import { LinkBox, LinkOverlay } from "../ui/link-overlay";
import { Skeleton } from "../ui/skeleton";

export interface UnitListItem {
	id: string;
	slug?: string | null;
	title: string | null;
	summary?: string | null;
	href?: string;
	cover?: { url: string; focalPoint: { x: number; y: number } } | null;
}

export function UnitList({
	items,
	pending,
	error,
	href,
}: {
	items: readonly UnitListItem[] | undefined;
	pending: boolean;
	error: boolean;
	href?: (item: UnitListItem) => string | undefined;
}) {
	const messages = useUiMessages();
	if (pending)
		return (
			<div className="grid gap-3">
				{Array.from({ length: 4 }, (_, index) => (
					<Skeleton key={index} className="h-24 rounded-xl" />
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

	return (
		<ItemGroup className="gap-0 overflow-hidden rounded-xl border bg-card">
			{items.map((item) => {
				const target = href?.(item) ?? item.href;
				return (
					<LinkBox key={item.id}>
						<Item
							className="rounded-none border-0 border-b shadow-none last:border-b-0 hover:bg-muted/40"
							role="listitem"
						>
							<ItemMedia
								className="bg-accent text-accent-foreground size-auto aspect-[2/3] w-14 self-stretch overflow-hidden rounded-md text-lg font-black"
								variant="image"
							>
								{item.cover ? (
									<img
										alt=""
										className="size-full object-cover"
										src={item.cover.url}
										style={{
											objectPosition: `${item.cover.focalPoint.x * 100}% ${item.cover.focalPoint.y * 100}%`,
										}}
									/>
								) : (
									(item.title ?? item.slug ?? "R").slice(0, 1)
								)}
							</ItemMedia>
							<ItemContent className="min-w-0 justify-center">
								<ItemTitle>
									{target ? (
										<LinkOverlay href={target}>
											{item.title ?? item.slug ?? messages.unnamed}
										</LinkOverlay>
									) : (
										(item.title ?? item.slug ?? messages.unnamed)
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
