"use client";
import { useState } from "react";
import {
	useGetCatalogDefinition,
	useGetCatalogDefinitionPermissions,
	useGetCatalogDefinitionRevision,
	useListCatalogDefinitionRevisions,
} from "@rezics/openapi-tanstack-query";
import { Badge, Button, PageHeading, QueryFailure, QueryPending } from "@rezics/ui";
import { AppLink } from "@/features/application-shell/components/app-link";
import { useApplicationRouter } from "@/features/application-shell/hooks/use-application-router";
import { useTranslation } from "@/i18n/client";
import { DefinitionBrowser } from "../components/definition-select";
import { DefinitionEditor } from "../components/definition-editor";
import { DefinitionMeaning } from "../components/definition-meaning";
import {
	definitionLabel,
	type DefinitionSelection,
	type DefinitionRevision,
} from "../model/definition-draft";
export function CatalogDefinitionsPage() {
	const { t } = useTranslation(["units"]),
		copy = t.units.nativeDefinitions;
	const permission = useGetCatalogDefinitionPermissions();
	return (
		<main className="mx-auto grid max-w-4xl gap-6 px-4 py-8">
			<PageHeading
				title={copy.title}
				action={
					permission.data?.canManage ? (
						<Button asChild>
							<AppLink href="/catalog/definitions/new">{copy.newDefinition}</AppLink>
						</Button>
					) : undefined
				}
			/>
			<DefinitionBrowser />
		</main>
	);
}
export function CatalogDefinitionCreatePage() {
	const { t } = useTranslation(["units", "errors"]),
		copy = t.units.nativeDefinitions,
		router = useApplicationRouter();
	const permission = useGetCatalogDefinitionPermissions();
	if (permission.isPending) return <QueryPending />;
	if (permission.isError)
		return <QueryFailure error={permission.error} retry={() => void permission.refetch()} />;
	return (
		<main className="mx-auto grid max-w-4xl gap-6 px-4 py-8">
			<PageHeading title={copy.newDefinition} />
			{permission.data.canManage ? (
				<DefinitionEditor onSaved={(id) => router.push(`/catalog/definitions/${id}`)} />
			) : (
				<p>{t.errors.forbidden}</p>
			)}
		</main>
	);
}
export function CatalogDefinitionPage({ id, revisionId }: { id: string; revisionId?: string }) {
	const { t, locale } = useTranslation(["units"]),
		copy = t.units.nativeDefinitions;
	const definition = useGetCatalogDefinition({ path: { id } }),
		permission = useGetCatalogDefinitionPermissions();
	const [editing, setEditing] = useState(false);
	if (definition.isPending) return <QueryPending />;
	if (definition.isError)
		return <QueryFailure error={definition.error} retry={() => void definition.refetch()} />;
	const selection: DefinitionSelection | undefined = definition.data.current
		? {
				definitionId: id,
				namespace: definition.data.namespace,
				key: definition.data.key,
				kind: definition.data.kind,
				revision: definition.data.current,
			}
		: undefined;
	return (
		<main className="mx-auto grid max-w-4xl gap-6 px-4 py-8">
			<PageHeading
				title={
					definition.data.current
						? (definitionLabel(definition.data.current, locale.target) ?? definition.data.key)
						: definition.data.key
				}
			/>
			<div className="flex flex-wrap gap-3">
				<Button asChild variant="outline">
					<AppLink href="/catalog/definitions">{copy.title}</AppLink>
				</Button>
				<Badge variant="outline">{copy.kinds[definition.data.kind]}</Badge>
			</div>
			<p className="text-sm text-muted-foreground">
				{definition.data.namespace} / {definition.data.key}
			</p>
			{revisionId ? (
				<ExactDefinitionRevision id={revisionId} definitionId={id} />
			) : definition.data.current ? (
				<DefinitionRevisionContent value={definition.data.current} />
			) : (
				<p>{copy.noCurrent}</p>
			)}
			{permission.data?.canManage && selection ? (
				<Button
					type="button"
					variant="outline"
					aria-expanded={editing}
					onClick={() => setEditing((current) => !current)}
				>
					{copy.revise}
				</Button>
			) : null}
			{editing && selection && permission.data?.canManage ? (
				<DefinitionEditor
					key={selection.revision.id}
					selection={selection}
					onSaved={() => {
						setEditing(false);
						void definition.refetch();
					}}
				/>
			) : null}
			<DefinitionHistory id={id} />
		</main>
	);
}
function ExactDefinitionRevision({ id, definitionId }: { id: string; definitionId: string }) {
	const { t } = useTranslation(["errors"]);
	const query = useGetCatalogDefinitionRevision({ path: { id } });
	if (query.isPending) return <QueryPending />;
	if (query.isError) return <QueryFailure error={query.error} retry={() => void query.refetch()} />;
	return query.data.definitionId === definitionId ? (
		<DefinitionRevisionContent value={query.data} />
	) : (
		<p>{t.errors.notFound}</p>
	);
}
function DefinitionRevisionContent({ value }: { value: DefinitionRevision }) {
	const { t } = useTranslation(["units"]),
		copy = t.units.nativeDefinitions;
	return (
		<section className="grid gap-4">
			<div className="flex flex-wrap gap-3">
				<Badge variant="outline">{value.version}</Badge>
				<Badge variant={value.reviewed ? "success" : "secondary"}>
					{value.reviewed ? copy.reviewed : copy.noReview}
				</Badge>
				{value.valueKind ? (
					<Badge variant="outline">{copy.valueKinds[value.valueKind]}</Badge>
				) : null}
			</div>
			<dl className="grid gap-3">
				{value.labels.map((label) => (
					<div key={label.languageTag} lang={label.languageTag}>
						<dt className="font-medium">{label.label}</dt>
						{label.description ? (
							<dd className="text-sm text-muted-foreground">{label.description}</dd>
						) : null}
					</div>
				))}
			</dl>
			<DefinitionMeaning value={value.constraints} />
		</section>
	);
}
function DefinitionHistory({ id }: { id: string }) {
	const { t, locale } = useTranslation(["units", "ui"]),
		copy = t.units.nativeDefinitions;
	const [cursors, setCursors] = useState<number[]>([]);
	const history = useListCatalogDefinitionRevisions({
		path: { id },
		query: { afterVersion: cursors.at(-1), languageTag: locale.target, limit: 25 },
	});
	if (history.isPending) return <QueryPending />;
	if (history.isError)
		return <QueryFailure error={history.error} retry={() => void history.refetch()} />;
	return (
		<section className="grid gap-3">
			<h2 className="text-xl font-semibold">{copy.history}</h2>
			<ul className="grid gap-2">
				{history.data.items.map((revision) => (
					<li key={revision.id}>
						<AppLink
							className="underline underline-offset-4"
							href={`/catalog/definitions/${id}?revision=${revision.id}`}
							lang={revision.label?.languageTag}
						>
							{revision.label?.label ?? copy.details} · {revision.version}
						</AppLink>
					</li>
				))}
			</ul>
			<div className="flex gap-2">
				{cursors.length ? (
					<Button
						type="button"
						variant="outline"
						onClick={() => setCursors((value) => value.slice(0, -1))}
					>
						{t.ui.shelf.previous}
					</Button>
				) : null}
				{history.data.afterVersion ? (
					<Button
						type="button"
						variant="outline"
						onClick={() => {
							const next = history.data.afterVersion;
							if (next) setCursors((value) => [...value, next]);
						}}
					>
						{t.ui.shelf.next}
					</Button>
				) : null}
			</div>
		</section>
	);
}
