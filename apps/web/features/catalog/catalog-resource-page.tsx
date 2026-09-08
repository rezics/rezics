"use client";
import type { CatalogReference } from "@rezics/reference";
import {
	useListCatalogIdentifiers,
	useListCatalogNames,
	useReadCatalogResource,
} from "@rezics/openapi-tanstack-query";
import { Badge, Button, PageHeading, QueryFailure, QueryPending } from "@rezics/ui";
import { useState } from "react";
import { useTranslation } from "@/i18n/client";
import { useHydratedSession } from "@/lib/use-hydrated-session";
import { PrivateFavoriteControl } from "@/features/favorites/private-favorite-control";

export function CatalogResourcePage({ reference }: { reference: CatalogReference }) {
	const { t, locale } = useTranslation(["units", "ui", "actions"]);
	const { data: session } = useHydratedSession();
	const resource = useReadCatalogResource({ path: reference });
	const names = useListCatalogNames({ path: reference, query: { limit: 50, maxSpoiler: 0 } });
	if (resource.isPending || names.isPending) return <QueryPending />;
	if (resource.isError)
		return <QueryFailure error={resource.error} retry={() => void resource.refetch()} />;
	if (names.isError) return <QueryFailure error={names.error} retry={() => void names.refetch()} />;
	const preferred =
		names.data.items.find((name) => name.languageTag === locale.target) ??
		names.data.items.find(
			(name) => name.languageTag?.split("-")[0] === locale.target.split("-")[0],
		) ??
		names.data.items[0];
	return (
		<main className="mx-auto grid w-full max-w-4xl gap-6 px-4 py-8">
			<PageHeading title={preferred?.value ?? t.ui.unnamed} />
			<div className="flex flex-wrap gap-2">
				{resource.data.status !== "published" ? <Badge>{t.ui[resource.data.status]}</Badge> : null}
				{resource.data.visibility !== "public" ? (
					<Badge>{t.ui[resource.data.visibility]}</Badge>
				) : null}
			</div>
			{session ? <PrivateFavoriteControl targetUnitId={reference.id} /> : null}
			<section className="grid gap-3">
				<h2 className="text-lg font-semibold">{t.units.nativeCatalog.names}</h2>
				<NamePage key={reference.id} reference={reference} />
			</section>
			<IdentifierPage key={`${reference.id}:identifiers`} reference={reference} />
		</main>
	);
}

function NamePage({ reference }: { reference: CatalogReference }) {
	const { t } = useTranslation(["actions", "ui"]);
	const [cursors, setCursors] = useState<string[]>([]);
	const query = useListCatalogNames({
		path: reference,
		query: { limit: 50, maxSpoiler: 0, afterId: cursors.at(-1) },
	});
	if (query.isPending) return <QueryPending />;
	if (query.isError) return <QueryFailure error={query.error} retry={() => void query.refetch()} />;
	return (
		<>
			<ul className="grid gap-2">
				{query.data.items.map((name) => (
					<li key={name.id} lang={name.languageTag ?? undefined} className="break-words">
						{name.value}
					</li>
				))}
			</ul>
			<div className="flex gap-2">
				{cursors.length ? (
					<Button variant="outline" onClick={() => setCursors((current) => current.slice(0, -1))}>
						{t.ui.shelf.previous}
					</Button>
				) : null}
				{query.data.nextCursor ? (
					<Button
						variant="outline"
						onClick={() => {
							const next = query.data.nextCursor;
							if (next) setCursors((current) => [...current, next]);
						}}
					>
						{t.actions.loadMore}
					</Button>
				) : null}
			</div>
		</>
	);
}

function IdentifierPage({ reference }: { reference: CatalogReference }) {
	const { t } = useTranslation(["units", "actions", "ui"]);
	const [cursors, setCursors] = useState<string[]>([]);
	const query = useListCatalogIdentifiers({
		path: reference,
		query: { limit: 50, afterId: cursors.at(-1) },
	});
	if (query.isPending) return <QueryPending />;
	if (query.isError) return <QueryFailure error={query.error} retry={() => void query.refetch()} />;
	if (!query.data.items.length && !query.data.nextCursor && !cursors.length) return null;
	return (
		<section className="grid gap-3">
			<h2 className="text-lg font-semibold">{t.units.nativeCatalog.identifiers}</h2>
			<dl className="grid gap-2">
				{query.data.items.map((identifier) => (
					<div key={identifier.id} className="grid gap-1 sm:grid-cols-[12rem_1fr]">
						<dt className="text-muted-foreground break-words">{identifier.namespace}</dt>
						<dd className="break-words">{identifier.value}</dd>
					</div>
				))}
			</dl>
			<div className="flex gap-2">
				{cursors.length ? (
					<Button variant="outline" onClick={() => setCursors((current) => current.slice(0, -1))}>
						{t.ui.shelf.previous}
					</Button>
				) : null}
				{query.data.nextCursor ? (
					<Button
						variant="outline"
						onClick={() => {
							const next = query.data.nextCursor;
							if (next) setCursors((current) => [...current, next]);
						}}
					>
						{t.actions.loadMore}
					</Button>
				) : null}
			</div>
		</section>
	);
}
