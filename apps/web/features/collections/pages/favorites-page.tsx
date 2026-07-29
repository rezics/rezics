"use client";

import { useGetApiCollectionsFavorites } from "@rezics/openapi-tanstack-query";
import { PageHeading, QueryFailure, QueryPending } from "@rezics/ui";

import { RequireSession } from "@/features/auth/require-session";
import { useTranslation } from "@/i18n/client";
import { useLocalizationLanguages } from "@/i18n/use-localization-languages";
import { CollectionContentFeed } from "../components/collection-content-feed";

export function FavoritesPage() {
	return (
		<RequireSession>
			<FavoritesContent />
		</RequireSession>
	);
}

function FavoritesContent() {
	const localizationLanguages = useLocalizationLanguages();
	const query = useGetApiCollectionsFavorites({
		query: { localizationLanguages },
	});
	const { t } = useTranslation(["collections"]);
	if (query.isPending) return <QueryPending />;
	if (query.isError)
		return <QueryFailure error={query.error} retry={() => void query.refetch()} />;
	return (
		<main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-0 py-8 sm:px-6 sm:py-10">
			<div className="px-4 sm:px-0">
				<PageHeading title={t.collections.favorites} />
			</div>
			<CollectionContentFeed collectionId={query.data.id} />
		</main>
	);
}
