"use client";

import { useGetApiCollectionsByCollectionId } from "@rezics/openapi-tanstack-query";
import { Badge, Button, Cover, PageHeading, QueryFailure, QueryPending } from "@rezics/ui";
import { AppLink as Link } from "@/features/application-shell/components/app-link";

import { useChineseContentText } from "@/features/content-language-display/chinese-content-display-context";
import { useTranslation } from "@/i18n/client";
import { useLocalizationFallbackToast } from "@/i18n/use-localization-fallback-toast";
import { useLocalizationLanguages } from "@/i18n/use-localization-languages";
import { selectLocalization } from "@/lib/localization";
import { CollectionContentFeed } from "../components/collection-content-feed";
import { PublisherAttributionLinks } from "@/features/posts/attribution-list";

export function CollectionDetailPage({ collectionId }: { readonly collectionId: string }) {
	const localizationLanguages = useLocalizationLanguages();
	const query = useGetApiCollectionsByCollectionId({
		path: { collectionId },
		query: { localizationLanguages },
	});
	const { t } = useTranslation(["collections", "ui"]);
	useLocalizationFallbackToast({
		actualLanguage: query.data?.language ?? null,
		localizationLanguages,
		unitId: collectionId,
	});
	const localization = query.data
		? selectLocalization(query.data.localizations, query.data.language)
		: null;
	const title = useChineseContentText(
		query.data?.purpose === "favorites"
			? t.collections.favorites
			: (localization?.title ?? t.ui.unnamed),
		query.data?.purpose !== "favorites" && localization?.title ? localization.language : null,
	);
	const summary = useChineseContentText(localization?.summary ?? "", localization?.language);
	if (query.isPending) return <QueryPending />;
	if (query.isError) return <QueryFailure error={query.error} retry={() => void query.refetch()} />;
	const collection = query.data;
	const canManage = Object.values(collection.capabilities).some(Boolean);
	return (
		<main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-0 py-8 sm:px-6 sm:py-10">
			<div className="grid gap-5 px-4 sm:px-0">
				<PageHeading
					action={
						canManage ? (
							<Button asChild variant="outline">
								<Link href={`/collections/${collectionId}/edit`}>
									{t.collections.editCollection}
								</Link>
							</Button>
						) : undefined
					}
					description={summary || undefined}
					title={title}
				/>
				<div className="flex flex-wrap items-center gap-3">
					{collection.cover ? (
						<Cover
							alt={title}
							className="w-24 rounded-xl border border-border-weak shadow-sm/5"
							src={collection.cover.url}
						/>
					) : null}
					<Badge variant="secondary">
						{t.collections.itemCount({ count: Number(collection.itemCount) })}
					</Badge>
					<PublisherAttributionLinks
						attributions={collection.attributions}
						emptyLabel={t.collections.publishers.unknown}
						publisherLabel={t.collections.publishers.label}
					/>
				</div>
			</div>
			<CollectionContentFeed collectionId={collectionId} />
		</main>
	);
}
