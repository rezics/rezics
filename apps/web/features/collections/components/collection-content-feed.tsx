"use client";

import { Badge, Button } from "@rezics/ui";

import { FeedItemCard } from "@/features/content-feed/components/feed-item-card";
import { FeedList } from "@/features/content-feed/components/feed-list";
import { useTranslation } from "@/i18n/client";
import { collectionContentItems, useCollectionContent } from "../data/collection-content";
import {
	toCollectionContentGroups,
	type CollectionContentGroup as CollectionContentGroupValue,
} from "../model/collection-content-tree";
import type { CollectionContentItem } from "../data/collection-content";

type CollectionLayout = "flat" | "nested" | "shelf";

export function CollectionContentFeed({
	collectionId,
	layout,
}: {
	readonly collectionId: string;
	readonly layout: CollectionLayout;
}) {
	const { t } = useTranslation(["actions", "collections", "state"]);
	const query = useCollectionContent(collectionId);
	const items = collectionContentItems(query);
	const footer = query.hasNextPage ? (
		<Button
			className="mx-auto mt-2 w-fit"
			isLoading={query.isFetchingNextPage}
			onClick={() => void query.fetchNextPage()}
			variant="outline"
		>
			{t.actions.loadMore}
		</Button>
	) : null;
	const state = query.isPending
		? ({ status: "pending" } as const)
		: query.isError && !query.data
			? ({ status: "error", retry: () => void query.refetch() } as const)
			: ({ status: "ready", items } as const);

	if (layout === "nested" && state.status === "ready")
		return (
			<FeedList
				aria-label={t.collections.contentLabel}
				emptyBody={t.collections.emptyCollectionBody}
				emptyTitle={t.collections.emptyCollectionTitle}
				errorLabel={t.state.error}
				footer={footer}
				getItemKey={(group) => group.root.membership.targetId}
				renderItem={(group, metadata) => (
					<CollectionContentGroup
						group={group}
						position={metadata.position}
						setSize={metadata.setSize}
					/>
				)}
				retryLabel={t.actions.retry}
				state={{ status: "ready", items: toCollectionContentGroups(items) }}
			/>
		);

	return (
		<FeedList
			aria-label={t.collections.contentLabel}
			className={layout === "shelf" ? "items-start lg:grid-cols-2" : undefined}
			emptyBody={t.collections.emptyCollectionBody}
			emptyTitle={t.collections.emptyCollectionTitle}
			errorLabel={t.state.error}
			footer={footer}
			getItemKey={(item) => item.membership.targetId}
			renderItem={(item, metadata) => (
				<CollectionFeedItem
					item={item}
					position={metadata.position}
					setSize={metadata.setSize}
				/>
			)}
			retryLabel={t.actions.retry}
			state={state}
		/>
	);
}

function CollectionContentGroup({
	group,
	position,
	setSize,
}: {
	readonly group: CollectionContentGroupValue<CollectionContentItem>;
	readonly position: number;
	readonly setSize: number;
}) {
	return (
		<div className="grid gap-3">
			<CollectionFeedItem item={group.root} position={position} setSize={setSize} />
			{group.children.length ? (
				<div className="ms-4 grid gap-3 border-s-2 border-border-weak ps-3 sm:ms-8 sm:ps-4">
					{group.children.map((child, index) => (
						<CollectionContentGroup
							group={child}
							key={child.root.membership.targetId}
							position={index + 1}
							setSize={group.children.length}
						/>
					))}
				</div>
			) : null}
		</div>
	);
}

function CollectionFeedItem({
	item,
	position,
	setSize,
}: {
	readonly item: CollectionContentItem;
	readonly position: number;
	readonly setSize: number;
}) {
	const { t } = useTranslation(["collections"]);
	return (
		<div className="grid gap-2">
			{item.membership.role === "featured" ? (
				<Badge className="ms-3 w-fit sm:ms-4" variant="secondary">
					{t.collections.items.featured}
				</Badge>
			) : null}
			<FeedItemCard item={item.content} position={position} setSize={setSize} />
		</div>
	);
}
