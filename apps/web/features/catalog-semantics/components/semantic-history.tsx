"use client";
import { useState } from "react";
import type { CatalogReference } from "@rezics/reference";
import {
	useListCatalogSemanticHistory,
	useRestoreCatalogSemanticRevision,
	useTransitionCatalogSemanticState,
} from "@rezics/openapi-tanstack-query";
import { Badge, Button, QueryFailure, QueryPending } from "@rezics/ui";
import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import { FactValue } from "./fact-value";
import { RelationValue } from "./relation-value";
export function SemanticStateActions({
	reference,
	revision,
	semanticId,
	headVersion,
	onSaved,
}: {
	reference: CatalogReference;
	revision: number;
	semanticId: string;
	headVersion: number;
	onSaved: () => void;
}) {
	const { t } = useTranslation(["units"]),
		copy = t.units.nativeSemantics,
		mutation = useTransitionCatalogSemanticState();
	return (
		<div className="grid gap-3">
			<div className="flex flex-wrap gap-2">
				{(["disputed", "withdrawn", "superseded"] as const).map((state) => (
					<Button
						type="button"
						variant="outline"
						key={state}
						disabled={mutation.isPending}
						onClick={() => {
							void mutation
								.mutateAsync({
									path: { ...reference, semanticId },
									body: { expectedRevision: revision, expectedHeadVersion: headVersion, state },
								})
								.then(onSaved)
								.catch(() => undefined);
						}}
					>
						{copy.transitions[state]}
					</Button>
				))}
			</div>
			{mutation.error ? <RequestFailure error={mutation.error} /> : null}
		</div>
	);
}
export function SemanticHistory({
	reference,
	revision,
	semanticId,
	headVersion,
	spoiler,
	canEdit,
	onSaved,
}: {
	reference: CatalogReference;
	revision: number;
	semanticId: string;
	headVersion: number;
	spoiler: 0 | 1 | 2;
	canEdit: boolean;
	onSaved: () => void;
}) {
	const { t } = useTranslation(["units", "ui", "actions"]),
		copy = t.units.nativeSemantics,
		[cursors, setCursors] = useState<number[]>([]),
		[expanded, setExpanded] = useState<number>();
	const path = { ...reference, semanticId },
		query = useListCatalogSemanticHistory({
			path,
			query: { limit: 25, afterVersion: cursors.at(-1) },
		}),
		restore = useRestoreCatalogSemanticRevision();
	if (query.isPending) return <QueryPending />;
	if (query.isError) return <QueryFailure error={query.error} retry={() => void query.refetch()} />;
	return (
		<section className="grid gap-3">
			<h4 className="font-medium">{copy.history}</h4>
			{query.data.items.map((item) => (
				<article key={item.version} className="grid gap-3 rounded border p-3">
					<div className="flex flex-wrap gap-2">
						<Badge variant="outline">{item.version}</Badge>
						<Badge>{copy.states[item.state]}</Badge>
						<time dateTime={item.createdAt}>{item.createdAt}</time>
					</div>
					{item.factId || item.relationId ? (
						<Button
							type="button"
							variant="outline"
							aria-expanded={expanded === item.version}
							onClick={() =>
								setExpanded((current) => (current === item.version ? undefined : item.version))
							}
						>
							{copy.inspectValue}
						</Button>
					) : null}
					{expanded === item.version ? (
						<>
							{item.factId && item.definitionRevisionId ? (
								<FactValue
									reference={reference}
									factId={item.factId}
									definitionRevisionId={item.definitionRevisionId}
									spoiler={spoiler}
								/>
							) : item.relationId ? (
								<RelationValue
									reference={reference}
									relationId={item.relationId}
									spoiler={spoiler}
								/>
							) : null}
							{canEdit && item.version !== headVersion ? (
								<Button
									type="button"
									disabled={restore.isPending}
									onClick={() => {
										void restore
											.mutateAsync({
												path,
												body: {
													expectedRevision: revision,
													expectedHeadVersion: headVersion,
													restoreVersion: item.version,
												},
											})
											.then(() => {
												void query.refetch();
												onSaved();
											})
											.catch(() => undefined);
									}}
								>
									{copy.restore}
								</Button>
							) : null}
						</>
					) : null}
				</article>
			))}
			{restore.error ? <RequestFailure error={restore.error} /> : null}
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
				{query.data.afterVersion !== null ? (
					<Button
						type="button"
						variant="outline"
						onClick={() => {
							const next = query.data.afterVersion;
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
