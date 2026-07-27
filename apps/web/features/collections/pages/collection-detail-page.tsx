"use client";

import { useGetApiCollectionsByCollectionId } from "@rezics/openapi-tanstack-query";
import { Badge, Button, Cover, PageHeading, QueryFailure, QueryPending } from "@rezics/ui";
import Link from "next/link";

import { useTranslation } from "@/i18n/client";
import { useLocalizationFallbackToast } from "@/i18n/use-localization-fallback-toast";
import { useLocalizationLanguages } from "@/i18n/use-localization-languages";
import { selectLocalization } from "@/lib/localization";
import { CollectionContentFeed } from "../components/collection-content-feed";

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
	if (query.isPending) return <QueryPending />;
	if (query.isError)
		return <QueryFailure error={query.error} retry={() => void query.refetch()} />;
	const collection = query.data;
	const localization = selectLocalization(collection.localizations, collection.language);
	const canManage = Object.values(collection.capabilities).some(Boolean);
	const title =
		collection.systemKey === "favorites"
			? t.collections.favorites
			: (localization?.title ?? t.ui.unnamed);
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
					description={localization?.summary ?? undefined}
					title={title}
				/>
				<div className="flex flex-wrap items-center gap-3">
					{localization?.cover ? (
						<Cover
							alt={title}
							className="w-24 rounded-xl border border-border-weak shadow-sm/5"
							src={localization.cover.url}
						/>
					) : null}
					<Badge variant="secondary">
						{t.collections.itemCount({ count: Number(collection.itemCount) })}
					</Badge>
				</div>
			</div>
			<CollectionContentFeed
				collectionId={collectionId}
				layout={collection.presentationDocument.layout}
			/>
		</main>
	);
}
