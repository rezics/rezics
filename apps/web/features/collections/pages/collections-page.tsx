"use client";

import { useGetApiCollections, useGetApiUsersMe } from "@rezics/openapi-tanstack-query";
import { Button, PageHeading, QueryFailure, QueryPending, UnitList } from "@rezics/ui";
import Link from "next/link";

import { useTranslation } from "@/i18n/client";
import { useLocalizationLanguages } from "@/i18n/use-localization-languages";
import { useHydratedSession } from "@/lib/use-hydrated-session";

export function CollectionsPage() {
	const localizationLanguages = useLocalizationLanguages();
	const session = useHydratedSession();
	const me = useGetApiUsersMe({ query: { enabled: Boolean(session.data) } });
	const query = useGetApiCollections(
		{
			query: {
				...(me.data?.id ? { ownerId: me.data.id } : {}),
				limit: 50,
				localizationLanguages,
			},
		},
		{ query: { enabled: !session.data || Boolean(me.data?.id) } },
	);
	const { t } = useTranslation(["collections"]);
	if (session.isPending || (session.data && me.isPending) || query.isPending)
		return <QueryPending />;
	if (me.isError || query.isError)
		return (
			<QueryFailure
				error={me.error ?? query.error}
				retry={() => void Promise.all([me.refetch(), query.refetch()])}
			/>
		);
	return (
		<main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-10 sm:px-6">
			<PageHeading
				action={
					<Button asChild variant="solid">
						<Link href="/collections/new">{t.collections.newCollection}</Link>
					</Button>
				}
				title={t.collections.title}
			/>
			<UnitList
				error={false}
				href={(collection) => `/collections/${collection.id}`}
				items={query.data.items.map((collection) =>
					collection.systemKey === "favorites"
						? { ...collection, title: t.collections.favorites }
						: collection,
				)}
				pending={false}
				variant="shelf"
			/>
		</main>
	);
}
