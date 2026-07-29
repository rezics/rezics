"use client";

import { Button } from "@rezics/ui";

import { FeedItemCard } from "@/features/content-feed/components/feed-item-card";
import { FeedList } from "@/features/content-feed/components/feed-list";
import { useTranslation } from "@/i18n/client";
import { collectionContentItems, useCollectionContent } from "../data/collection-content";

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
			getItemKey={(item) => item.membership.targetId}
			renderItem={(item, metadata) => (
				<FeedItemCard
					item={item.content}
					position={metadata.position}
					setSize={metadata.setSize}
				/>
			)}
			retryLabel={t.actions.retry}
			state={state}
		/>
	);
}
