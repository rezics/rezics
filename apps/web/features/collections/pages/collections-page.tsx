"use client";

import { useGetApiUsersMe } from "@rezics/openapi-tanstack-query";
import { Button, PageHeading, QueryFailure, QueryPending, UnitList } from "@rezics/ui";
import { AppLink as Link } from "@/features/application-shell/components/app-link";
import { studioSectionCreateHref } from "@/features/create/model/studio-section";

import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import { useHydratedSession } from "@/lib/use-hydrated-session";
import { collectionListItems, useCollectionList } from "../data/collection-list";

export function CollectionsPage() {
	const session = useHydratedSession();
	const me = useGetApiUsersMe({}, { query: { enabled: Boolean(session.data) } });
	const query = useCollectionList({
		editableOnly: Boolean(me.data?.id),
		enabled: !session.data || Boolean(me.data?.id),
	});
	const { t } = useTranslation(["actions", "collections"]);
	if (session.isPending || (session.data && me.isPending)) return <QueryPending />;
	if (me.isError) return <QueryFailure error={me.error} retry={() => void me.refetch()} />;
	if (query.isPending) return <QueryPending />;
	if (query.isError && !query.data)
		return <QueryFailure error={query.error} retry={() => void query.refetch()} />;
	const items = collectionListItems(query);
	return (
		<main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-10 sm:px-6">
			<PageHeading
				action={
					<Button asChild variant="solid">
						<Link href={studioSectionCreateHref("collection")}>{t.collections.newCollection}</Link>
					</Button>
				}
				title={t.collections.title}
			/>
			<UnitList
				error={false}
				href={(collection) => `/collections/${collection.id}`}
				items={items.map((collection) =>
					collection.purpose === "favorites"
						? { ...collection, title: t.collections.favorites }
						: collection,
				)}
				pending={false}
				variant="shelf"
			/>
			{query.hasNextPage ? (
				<Button
					className="self-center"
					isLoading={query.isFetchingNextPage}
					onClick={() => void query.fetchNextPage()}
					variant="outline"
				>
					{t.actions.loadMore}
				</Button>
			) : null}
			<RequestFailure error={query.isFetchNextPageError ? query.error : null} />
		</main>
	);
}
