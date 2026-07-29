"use client";

import { Button } from "@rezics/ui";

import { FeedItemCard } from "@/features/content-feed/components/feed-item-card";
import { FeedList } from "@/features/content-feed/components/feed-list";
import { useTranslation } from "@/i18n/client";
import { collectionContentItems, useCollectionContent } from "../data/collection-content";
import {
	toCollectionContentGroups,
	type CollectionContentGroup as CollectionContentGroupValue,
} from "../model/collection-content-tree";
import type { CollectionContentItem } from "../data/collection-content";

export function CollectionContentFeed({ collectionId }: { readonly collectionId: string }) {
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
			state={
				state.status === "ready"
					? { status: "ready", items: toCollectionContentGroups(items) }
					: state
			}
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
	return <FeedItemCard item={item.content} position={position} setSize={setSize} />;
}
