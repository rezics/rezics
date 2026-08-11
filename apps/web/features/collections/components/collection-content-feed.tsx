"use client";

import { FeedItemCard } from "@/features/content-feed/components/feed-item-card";
import { FeedList } from "@/features/content-feed/components/feed-list";
import { resolveFeedContinuationState } from "@/features/content-feed/model/feed-continuation";
import { useTranslation } from "@/i18n/client";
import { collectionContentItems, useCollectionContent } from "../data/collection-content";

export function CollectionContentFeed({ collectionId }: { readonly collectionId: string }) {
	const { t } = useTranslation(["actions", "collections", "state"]);
	const query = useCollectionContent(collectionId);
	const items = collectionContentItems(query);
	const continuationState = resolveFeedContinuationState({
		fetchNextPage: () => query.fetchNextPage({ cancelRefetch: false }),
		hasNextPage: query.hasNextPage,
		isFetchNextPageError: query.isFetchNextPageError,
		isFetching: query.isFetching,
		isFetchingNextPage: query.isFetchingNextPage,
	});
	const state = query.isPending
		? ({ status: "pending" } as const)
		: query.isError && !query.data
			? ({ status: "error", retry: () => void query.refetch() } as const)
			: ({ status: "ready", items } as const);

	return (
		<FeedList
			aria-label={t.collections.contentLabel}
			continuation={{ mode: "load-more", state: continuationState }}
			emptyBody={t.collections.emptyCollectionBody}
			emptyTitle={t.collections.emptyCollectionTitle}
			errorLabel={t.state.error}
			getItemKey={(item) => item.membership.targetId}
			renderItem={(item, metadata) => (
				<FeedItemCard item={item.content} position={metadata.position} setSize={metadata.setSize} />
			)}
			retryLabel={t.actions.retry}
			state={state}
		/>
	);
}
