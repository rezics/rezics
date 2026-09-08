"use client";
import { useState } from "react";
import type { CatalogReference } from "@rezics/reference";
import {
	useListCatalogRelationParticipants,
	useListCatalogRelationQualifiers,
	useListCatalogDefinitionRevisionLabels,
} from "@rezics/openapi-tanstack-query";
import { Button, QueryFailure, QueryPending } from "@rezics/ui";
import { AppLink } from "@/features/application-shell/components/app-link";
import { useTranslation } from "@/i18n/client";
import { FactValue } from "./fact-value";
import { DefinitionLabelBatch, ExactDefinitionName } from "./definition-revision-options";
export function RelationValue({
	reference,
	relationId,
	spoiler,
}: {
	reference: CatalogReference;
	relationId: string;
	spoiler: 0 | 1 | 2;
}) {
	const { t } = useTranslation(["units"]),
		[qualifiers, setQualifiers] = useState(false);
	return (
		<div className="grid gap-4">
			<RelationParticipants reference={reference} relationId={relationId} spoiler={spoiler} />
			<Button
				type="button"
				variant="outline"
				aria-expanded={qualifiers}
				onClick={() => setQualifiers((current) => !current)}
			>
				{t.units.nativeSemantics.qualifiers}
			</Button>
			{qualifiers ? (
				<RelationQualifiers reference={reference} relationId={relationId} spoiler={spoiler} />
			) : null}
		</div>
	);
}
function RelationParticipants({
	reference,
	relationId,
	spoiler,
}: {
	reference: CatalogReference;
	relationId: string;
	spoiler: 0 | 1 | 2;
}) {
	const { t, locale } = useTranslation(["units", "ui", "actions"]),
		copy = t.units.nativeSemantics,
		[cursors, setCursors] = useState<number[]>([]);
	const query = useListCatalogRelationParticipants({
		path: { ...reference, relationId },
		query: {
			limit: 25,
			afterPosition: cursors.at(-1),
			maxSpoiler: spoiler,
			languageTag: locale.target,
		},
	});
	if (query.isPending) return <QueryPending />;
	if (query.isError) return <QueryFailure error={query.error} retry={() => void query.refetch()} />;
	return (
		<section className="grid gap-3">
			<h4 className="font-medium">{copy.participants}</h4>
			{query.data.items.length ? <ParticipantRows items={query.data.items} /> : null}
			<div className="flex gap-2">
				{cursors.length ? (
					<Button
						type="button"
						variant="outline"
						onClick={() => setCursors((current) => current.slice(0, -1))}
					>
						{t.ui.shelf.previous}
					</Button>
				) : null}
				{query.data.afterPosition !== null ? (
					<Button
						type="button"
						variant="outline"
						onClick={() => {
							const next = query.data.afterPosition;
							if (next !== null) setCursors((current) => [...current, next]);
						}}
					>
						{t.actions.loadMore}
					</Button>
				) : null}
			</div>
		</section>
	);
}
function ParticipantRows({
	items,
}: {
	items: NonNullable<ReturnType<typeof useListCatalogRelationParticipants>["data"]>["items"];
}) {
	const { t, locale } = useTranslation(["units"]),
		copy = t.units.nativeSemantics,
		query = useListCatalogDefinitionRevisionLabels({
			query: {
				ids: [...new Set(items.map((item) => item.roleRevisionId))],
				languageTag: locale.target,
			},
		});
	if (query.isPending) return <QueryPending />;
	if (query.isError) return <QueryFailure error={query.error} retry={() => void query.refetch()} />;
	const labels = new Map(query.data.items.map((item) => [item.id, item]));
	return (
		<dl className="grid gap-3">
			{items.map((item) => (
				<div key={item.position} className="grid gap-1 rounded border p-3">
					<dt className="text-sm text-muted-foreground">
						{labels.get(item.roleRevisionId)?.label?.label ?? copy.unnamedDefinition}
					</dt>
					<dd>
						{item.targetPreview ? (
							<AppLink
								className="underline"
								href={`/catalog/${item.target.owner}/${item.target.id}`}
							>
								{item.targetPreview.title ?? copy.unnamedTarget}
							</AppLink>
						) : (
							copy.unavailableTarget
						)}
					</dd>
					{item.creditedAs ? (
						<dd>
							{copy.creditedAs}: {item.creditedAs}
						</dd>
					) : null}
				</div>
			))}
		</dl>
	);
}
function RelationQualifiers({
	reference,
	relationId,
	spoiler,
}: {
	reference: CatalogReference;
	relationId: string;
	spoiler: 0 | 1 | 2;
}) {
	const { t } = useTranslation(["units", "ui", "actions"]),
		copy = t.units.nativeSemantics,
		[cursors, setCursors] = useState<string[]>([]),
		[expanded, setExpanded] = useState<string>();
	const query = useListCatalogRelationQualifiers({
		path: { ...reference, relationId },
		query: { limit: 25, afterId: cursors.at(-1), maxSpoiler: spoiler },
	});
	if (query.isPending) return <QueryPending />;
	if (query.isError) return <QueryFailure error={query.error} retry={() => void query.refetch()} />;
	return (
		<DefinitionLabelBatch ids={query.data.items.map((item) => item.definitionRevisionId)}>
			<section className="grid gap-3">
				{query.data.items.map((item) => (
					<div key={item.id} className="grid gap-3 rounded border p-3">
						<ExactDefinitionName id={item.definitionRevisionId} />
						<Button
							type="button"
							variant="outline"
							aria-expanded={expanded === item.id}
							onClick={() => setExpanded((current) => (current === item.id ? undefined : item.id))}
						>
							{copy.inspectValue}
						</Button>
						{expanded === item.id ? (
							<FactValue
								reference={reference}
								factId={item.valueFactId}
								definitionRevisionId={item.definitionRevisionId}
								spoiler={spoiler}
								relationId={relationId}
							/>
						) : null}
					</div>
				))}
				<div className="flex gap-2">
					{cursors.length ? (
						<Button
							type="button"
							variant="outline"
							onClick={() => setCursors((current) => current.slice(0, -1))}
						>
							{t.ui.shelf.previous}
						</Button>
					) : null}
					{query.data.afterId ? (
						<Button
							type="button"
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
		</DefinitionLabelBatch>
	);
}
