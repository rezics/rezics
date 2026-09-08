"use client";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { CatalogReference } from "@rezics/reference";
import {
	useReadCatalogResource,
	useListCatalogFacts,
	useListCatalogRelations,
	listCatalogFactsQueryKey,
	listCatalogRelationsQueryKey,
} from "@rezics/openapi-tanstack-query";
import { Badge, Button, PageHeading, QueryFailure, QueryPending } from "@rezics/ui";
import { AppLink } from "@/features/application-shell/components/app-link";
import { useTranslation } from "@/i18n/client";
import {
	DefinitionChoice,
	DefinitionFlag,
} from "@/features/catalog-definitions/components/definition-fields";
import {
	DefinitionLabelBatch,
	ExactDefinitionName,
} from "../components/definition-revision-options";
import { FactEditor, FactEditorLoader, type FactSummary } from "../components/fact-editor";
import { RelationEditor } from "../components/relation-editor";
import { RelationEditorLoader, type RelationSummary } from "../components/relation-editor-loader";
import { FactValue } from "../components/fact-value";
import { RelationValue } from "../components/relation-value";
import { SemanticHistory, SemanticStateActions } from "../components/semantic-history";
import { EntityContextMeasurements } from "../components/entity-context-measurements";
type PageContext = {
	reference: CatalogReference;
	revision: number;
	spoiler: 0 | 1 | 2;
	canEdit: boolean;
	includeInactive: boolean;
	onChanged: () => void;
};
export function CatalogSemanticsPage({ reference }: { reference: CatalogReference }) {
	return (
		<CatalogSemanticsContent key={`${reference.owner}:${reference.id}`} reference={reference} />
	);
}
function CatalogSemanticsContent({ reference }: { reference: CatalogReference }) {
	const { t } = useTranslation(["units"]),
		copy = t.units.nativeSemantics;
	const [spoiler, setSpoiler] = useState<0 | 1 | 2>(0),
		[creating, setCreating] = useState<"fact" | "relation" | null>(null),
		[epoch, setEpoch] = useState(0),
		[includeInactive, setIncludeInactive] = useState(false);
	const resource = useReadCatalogResource({ path: reference }),
		cache = useQueryClient();
	if (resource.isPending) return <QueryPending />;
	if (resource.isError)
		return <QueryFailure error={resource.error} retry={() => void resource.refetch()} />;
	const onChanged = () => {
		void Promise.all([
			resource.refetch(),
			cache.invalidateQueries({ queryKey: listCatalogFactsQueryKey({ path: reference }) }),
			cache.invalidateQueries({ queryKey: listCatalogRelationsQueryKey({ path: reference }) }),
		]).then(() => {
			setEpoch((value) => value + 1);
			setCreating(null);
		});
	};
	const context: PageContext = {
		reference,
		revision: resource.data.revision,
		spoiler,
		canEdit: resource.data.canEdit,
		includeInactive: resource.data.canEdit && includeInactive,
		onChanged,
	};
	return (
		<main className="mx-auto grid max-w-4xl gap-6 px-4 py-8">
			<PageHeading title={copy.title} />
			<div className="flex flex-wrap gap-2">
				<Button asChild variant="outline">
					<AppLink href={`/catalog/${reference.owner}/${reference.id}`}>{copy.openRecord}</AppLink>
				</Button>
				{context.canEdit ? (
					<>
						<Button
							variant="outline"
							aria-expanded={creating === "fact"}
							onClick={() => setCreating((current) => (current === "fact" ? null : "fact"))}
						>
							{copy.addFact}
						</Button>
						<Button
							variant="outline"
							aria-expanded={creating === "relation"}
							onClick={() => setCreating((current) => (current === "relation" ? null : "relation"))}
						>
							{copy.addRelation}
						</Button>
					</>
				) : null}
			</div>
			<DefinitionChoice
				label={copy.spoilerVisibility}
				value={String(spoiler)}
				values={["0", "1", "2"]}
				labelFor={(value) =>
					value === "0" ? copy.spoilerNone : value === "1" ? copy.spoilerMinor : copy.spoilerMajor
				}
				onChange={(value) => setSpoiler(value === "0" ? 0 : value === "1" ? 1 : 2)}
			/>
			{context.canEdit ? (
				<DefinitionFlag
					label={copy.includeInactive}
					value={includeInactive}
					onChange={setIncludeInactive}
				/>
			) : null}
			{reference.owner === "entity" && resource.data.shape === "character" ? (
				<EntityContextMeasurements entityId={reference.id} onSaved={onChanged} />
			) : null}
			{context.canEdit && creating === "fact" ? (
				<FactEditor reference={reference} revision={resource.data.revision} onSaved={onChanged} />
			) : context.canEdit && creating === "relation" ? (
				<RelationEditor
					reference={reference}
					revision={resource.data.revision}
					onSaved={onChanged}
				/>
			) : null}
			<FactPage key={`facts:${epoch}:${spoiler}:${context.includeInactive}`} {...context} />
			<RelationPage key={`relations:${epoch}:${spoiler}:${context.includeInactive}`} {...context} />
		</main>
	);
}
function FactPage(context: PageContext) {
	const { t } = useTranslation(["units", "ui", "actions"]),
		[cursors, setCursors] = useState<string[]>([]),
		query = useListCatalogFacts({
			path: context.reference,
			query: {
				limit: 25,
				maxSpoiler: context.spoiler,
				afterId: cursors.at(-1),
				includeInactive: context.includeInactive ? "true" : "false",
			},
		});
	if (query.isPending) return <QueryPending />;
	if (query.isError) return <QueryFailure error={query.error} retry={() => void query.refetch()} />;
	return (
		<section className="grid gap-4">
			<h2 className="text-lg font-semibold">{t.units.nativeSemantics.facts}</h2>
			{query.data.items.length ? (
				<DefinitionLabelBatch ids={query.data.items.map((item) => item.definitionRevisionId)}>
					{query.data.items.map((fact) => (
						<SemanticCard key={fact.id} context={context} item={{ kind: "fact", value: fact }} />
					))}
				</DefinitionLabelBatch>
			) : (
				<p>{t.units.nativeSemantics.noFacts}</p>
			)}
			<div className="flex gap-2">
				{cursors.length ? (
					<Button variant="outline" onClick={() => setCursors((current) => current.slice(0, -1))}>
						{t.ui.shelf.previous}
					</Button>
				) : null}
				{query.data.afterId ? (
					<Button
						variant="outline"
						onClick={() => {
							const next = query.data.afterId;
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
function RelationPage(context: PageContext) {
	const { t } = useTranslation(["units", "ui", "actions"]),
		[cursors, setCursors] = useState<string[]>([]),
		query = useListCatalogRelations({
			path: context.reference,
			query: {
				limit: 25,
				maxSpoiler: context.spoiler,
				afterId: cursors.at(-1),
				includeInactive: context.includeInactive ? "true" : "false",
			},
		});
	if (query.isPending) return <QueryPending />;
	if (query.isError) return <QueryFailure error={query.error} retry={() => void query.refetch()} />;
	return (
		<section className="grid gap-4">
			<h2 className="text-lg font-semibold">{t.units.nativeSemantics.relations}</h2>
			{query.data.items.length ? (
				<DefinitionLabelBatch ids={query.data.items.map((item) => item.definitionRevisionId)}>
					{query.data.items.map((relation) => (
						<SemanticCard
							key={relation.id}
							context={context}
							item={{ kind: "relation", value: relation }}
						/>
					))}
				</DefinitionLabelBatch>
			) : (
				<p>{t.units.nativeSemantics.noRelations}</p>
			)}
			<div className="flex gap-2">
				{cursors.length ? (
					<Button variant="outline" onClick={() => setCursors((current) => current.slice(0, -1))}>
						{t.ui.shelf.previous}
					</Button>
				) : null}
				{query.data.afterId ? (
					<Button
						variant="outline"
						onClick={() => {
							const next = query.data.afterId;
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
function SemanticCard({
	context,
	item,
}: {
	context: PageContext;
	item: { kind: "fact"; value: FactSummary } | { kind: "relation"; value: RelationSummary };
}) {
	const { t } = useTranslation(["units"]),
		copy = t.units.nativeSemantics,
		[expanded, setExpanded] = useState(false),
		[history, setHistory] = useState(false),
		[editing, setEditing] = useState(false),
		value = item.value;
	return (
		<article className="grid gap-4 rounded-xl border p-4">
			<div className="flex flex-wrap items-center gap-3">
				<ExactDefinitionName id={value.definitionRevisionId} />
				<Badge>{copy.states[value.state]}</Badge>
			</div>
			<div className="flex flex-wrap gap-2">
				<Button
					variant="outline"
					aria-expanded={expanded}
					onClick={() => setExpanded((current) => !current)}
				>
					{copy.inspectValue}
				</Button>
				{context.canEdit ? (
					<Button
						variant="outline"
						aria-expanded={history}
						onClick={() => setHistory((current) => !current)}
					>
						{copy.history}
					</Button>
				) : null}
				{context.canEdit ? (
					<Button
						variant="outline"
						aria-expanded={editing}
						onClick={() => setEditing((current) => !current)}
					>
						{copy.revise}
					</Button>
				) : null}
			</div>
			{expanded ? (
				item.kind === "fact" ? (
					<FactValue
						reference={context.reference}
						factId={value.id}
						definitionRevisionId={value.definitionRevisionId}
						spoiler={context.spoiler}
					/>
				) : (
					<RelationValue
						reference={context.reference}
						relationId={value.id}
						spoiler={context.spoiler}
					/>
				)
			) : null}
			{editing && context.canEdit ? (
				<>
					{item.kind === "fact" ? (
						<FactEditorLoader
							reference={context.reference}
							revision={context.revision}
							fact={item.value}
							onSaved={context.onChanged}
						/>
					) : (
						<RelationEditorLoader
							reference={context.reference}
							revision={context.revision}
							relation={item.value}
							onSaved={context.onChanged}
						/>
					)}
					<SemanticStateActions
						reference={context.reference}
						revision={context.revision}
						semanticId={value.semanticId}
						headVersion={value.headVersion}
						currentState={value.state}
						onSaved={context.onChanged}
					/>
				</>
			) : null}
			{history && context.canEdit ? (
				<SemanticHistory
					reference={context.reference}
					revision={context.revision}
					semanticId={value.semanticId}
					headVersion={value.headVersion}
					currentState={value.state}
					spoiler={context.spoiler}
					canEdit={context.canEdit}
					onSaved={context.onChanged}
				/>
			) : null}
		</article>
	);
}
