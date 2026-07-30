"use client";

import {
	Alert,
	AlertAction,
	AlertDescription,
	Button,
	CardContent,
	Skeleton,
	cn,
} from "@rezics/ui";
import { Fragment, type ComponentProps, type Key, type ReactNode } from "react";

import { FeedCard } from "./feed-card";

export type FeedListState<Item> =
	| Readonly<{ status: "pending" }>
	| Readonly<{ status: "error"; retry: () => void }>
	| Readonly<{ status: "ready"; items: readonly Item[] }>;

export interface FeedListItemMetadata {
	readonly position: number;
	readonly setSize: number;
}

/**
 * Data-independent content stream renderer.
 *
 * @todo Add a non-card presentation after both visual variants have stable
 * product requirements. Until then every FeedList uses the canonical card
 * presentation so feature owners cannot create local list variants.
 */
export function FeedList<Item>({
	"aria-label": ariaLabel,
	className,
	emptyBody,
	emptyTitle,
	errorLabel,
	footer,
	getItemKey,
	renderItem,
	retryLabel,
	semantic = "feed",
	setSize,
	state,
}: {
	readonly "aria-label": string;
	readonly className?: string;
	readonly emptyBody: string;
	readonly emptyTitle: string;
	readonly errorLabel: string;
	readonly footer?: ReactNode;
	readonly getItemKey: (item: Item) => Key;
	readonly renderItem: (item: Item, metadata: FeedListItemMetadata) => ReactNode;
	readonly retryLabel: string;
	readonly semantic?: "feed" | "list";
	readonly setSize?: number;
	readonly state: FeedListState<Item>;
}) {
	if (state.status === "pending")
		return (
			<div aria-busy="true" aria-label={ariaLabel} className="grid gap-2 p-3 sm:p-4">
				{Array.from({ length: 4 }, (_, index) => (
					<FeedSkeleton key={index} />
				))}
			</div>
		);

	if (state.status === "error")
		return (
			<Alert className="m-3 sm:m-4" variant="destructive">
				<AlertDescription>{errorLabel}</AlertDescription>
				<AlertAction>
					<Button onClick={state.retry} size="sm" variant="quiet">
						{retryLabel}
					</Button>
				</AlertAction>
			</Alert>
		);

	if (state.items.length === 0) return <FeedEmptyState body={emptyBody} title={emptyTitle} />;

	return (
		<>
			<FeedListItems aria-label={ariaLabel} className={className} semantic={semantic}>
				{state.items.map((item, index) => (
					<Fragment key={getItemKey(item)}>
						{renderItem(item, {
							position: index + 1,
							setSize: setSize ?? state.items.length,
						})}
					</Fragment>
				))}
			</FeedListItems>
			{footer}
		</>
	);
}

export function FeedListItems({
	children,
	className,
	semantic = "feed",
	...props
}: Omit<ComponentProps<"div">, "role"> & {
	readonly semantic?: "feed" | "list";
}) {
	return (
		<div
			className={cn("grid w-full gap-3 bg-transparent sm:gap-4", className)}
			data-slot="feed-list-items"
			role={semantic}
			{...props}
		>
			{children}
		</div>
	);
}

function FeedEmptyState({ body, title }: { readonly body: string; readonly title: string }) {
	return (
		<div className="grid min-h-56 place-items-center p-8 text-center">
			<div>
				<p className="font-heading font-bold">{title}</p>
				<p className="mt-1 text-muted-foreground text-sm">{body}</p>
			</div>
		</div>
	);
}

function FeedSkeleton() {
	return (
		<FeedCard aria-hidden>
			<CardContent className="grid grid-cols-[5rem_minmax(0,1fr)] gap-4 px-4 py-5 sm:grid-cols-[7.5rem_minmax(0,1fr)] sm:px-5">
				<Skeleton className="aspect-[3/4] w-full rounded-xl" />
				<div className="grid content-start gap-3">
					<Skeleton className="h-4 w-1/3" />
					<Skeleton className="h-5 w-2/3" />
					<Skeleton className="h-16 w-full" />
				</div>
			</CardContent>
		</FeedCard>
	);
}
