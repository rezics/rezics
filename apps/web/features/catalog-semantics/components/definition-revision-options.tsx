"use client";
import { createContext, useContext, useState, type ReactNode } from "react";
import { useQueries } from "@tanstack/react-query";
import {
	listCatalogDefinitionRevisionLabels,
	useListCatalogDefinitionRevisionLabels,
	type ListCatalogDefinitionRevisionLabelsStatus200,
} from "@rezics/openapi-tanstack-query";
import { Button, QueryFailure, QueryPending } from "@rezics/ui";
import { useTranslation } from "@/i18n/client";
import { AppLink } from "@/features/application-shell/components/app-link";
type RevisionLabel = ListCatalogDefinitionRevisionLabelsStatus200["items"][number];
const DefinitionLabelContext = createContext<ReadonlyMap<string, RevisionLabel>>(new Map());
export function DefinitionLabelBatch({
	ids,
	children,
}: {
	ids: readonly string[];
	children: ReactNode;
}) {
	const { locale } = useTranslation(["units"]),
		unique = [...new Set(ids)],
		batches: string[][] = [];
	for (let index = 0; index < unique.length; index += 32)
		batches.push(unique.slice(index, index + 32));
	const queries = useQueries({
		queries: batches.map((batch) => ({
			queryKey: ["catalog-exact-definition-labels", locale.target, ...batch],
			queryFn: async () => {
				const { data } = await listCatalogDefinitionRevisionLabels({
					query: { ids: batch, languageTag: locale.target },
				});
				return data;
			},
		})),
	});
	const failure = queries.find((query) => query.isError);
	if (failure) return <QueryFailure error={failure.error} retry={() => void failure.refetch()} />;
	if (queries.some((query) => query.isPending)) return <QueryPending />;
	const labels = new Map(
		queries.flatMap((query) => query.data?.items ?? []).map((item) => [item.id, item]),
	);
	return (
		<DefinitionLabelContext.Provider value={labels}>{children}</DefinitionLabelContext.Provider>
	);
}
export function DefinitionRevisionOptions({
	ids,
	label,
	value,
	onSelect,
}: {
	ids: readonly string[];
	label: string;
	value?: string;
	onSelect: (id: string) => void;
}) {
	const { t } = useTranslation(["units"]),
		[open, setOpen] = useState(false);
	return (
		<fieldset className="grid gap-3 rounded border p-3">
			<legend>{label}</legend>
			{value ? <ExactDefinitionName id={value} /> : null}
			<Button
				type="button"
				variant="outline"
				aria-expanded={open}
				onClick={() => setOpen((current) => !current)}
			>
				{t.units.nativeDefinitions.choose}
			</Button>
			{open && ids.length ? (
				<RevisionOptionsPage
					key={ids.join(":")}
					ids={ids}
					onSelect={(id) => {
						onSelect(id);
						setOpen(false);
					}}
				/>
			) : null}
		</fieldset>
	);
}
function RevisionOptionsPage({
	ids,
	onSelect,
}: {
	ids: readonly string[];
	onSelect: (id: string) => void;
}) {
	const { t, locale } = useTranslation(["units", "actions", "ui"]),
		[page, setPage] = useState(0);
	const query = useListCatalogDefinitionRevisionLabels({
		query: { ids: ids.slice(page * 25, (page + 1) * 25), languageTag: locale.target },
	});
	if (query.isPending) return <QueryPending />;
	if (query.isError) return <QueryFailure error={query.error} retry={() => void query.refetch()} />;
	return (
		<div className="grid gap-3">
			{query.data.items.map((item) => (
				<div key={item.id} className="flex items-center gap-3">
					<Button type="button" variant="outline" onClick={() => onSelect(item.id)}>
						{item.label?.label ?? t.units.nativeSemantics.unnamedDefinition} · {item.version}
					</Button>
					<AppLink
						className="text-sm underline"
						href={`/catalog/definitions/${item.definitionId}?revision=${item.id}`}
					>
						{t.units.nativeDefinitions.details}
					</AppLink>
				</div>
			))}
			<div className="flex gap-2">
				{page ? (
					<Button type="button" variant="outline" onClick={() => setPage((value) => value - 1)}>
						{t.ui.shelf.previous}
					</Button>
				) : null}
				{(page + 1) * 25 < ids.length ? (
					<Button type="button" variant="outline" onClick={() => setPage((value) => value + 1)}>
						{t.actions.loadMore}
					</Button>
				) : null}
			</div>
		</div>
	);
}
export function ExactDefinitionName({ id }: { id: string }) {
	const { t } = useTranslation(["units"]),
		label = useContext(DefinitionLabelContext).get(id);
	return label ? (
		<AppLink
			className="underline underline-offset-4"
			href={`/catalog/definitions/${label.definitionId}?revision=${label.id}`}
		>
			{label.label?.label ?? t.units.nativeSemantics.unnamedDefinition} · {label.version}
		</AppLink>
	) : (
		<ResolvedExactDefinitionName id={id} />
	);
}
function ResolvedExactDefinitionName({ id }: { id: string }) {
	const { t, locale } = useTranslation(["units"]),
		query = useListCatalogDefinitionRevisionLabels({
			query: { ids: [id], languageTag: locale.target },
		});
	if (query.isPending) return <QueryPending />;
	if (query.isError) return <QueryFailure error={query.error} retry={() => void query.refetch()} />;
	const item = query.data.items[0];
	return item ? (
		<AppLink
			className="underline underline-offset-4"
			href={`/catalog/definitions/${item.definitionId}?revision=${item.id}`}
		>
			{item.label?.label ?? t.units.nativeSemantics.unnamedDefinition} · {item.version}
		</AppLink>
	) : null;
}
