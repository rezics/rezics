"use client";
import { useState } from "react";
import type { CatalogReference } from "@rezics/reference";
import {
	useGetCatalogDefinitionRevision,
	useListCatalogFactNodes,
} from "@rezics/openapi-tanstack-query";
import { Button, QueryFailure, QueryPending } from "@rezics/ui";
import { useTranslation } from "@/i18n/client";
import { DefinitionLabelBatch, ExactDefinitionName } from "./definition-revision-options";
import { valueRules } from "../model/semantic-draft";
export function FactValue({
	reference,
	factId,
	definitionRevisionId,
	spoiler,
	relationId,
}: {
	reference: CatalogReference;
	factId: string;
	definitionRevisionId: string;
	spoiler: 0 | 1 | 2;
	relationId?: string;
}) {
	const { t } = useTranslation(["units", "ui", "actions"]),
		copy = t.units.nativeSemantics;
	const [cursors, setCursors] = useState<number[]>([]);
	const definition = useGetCatalogDefinitionRevision({ path: { id: definitionRevisionId } }),
		query = useListCatalogFactNodes({
			path: { ...reference, factId },
			query: { limit: 25, afterPosition: cursors.at(-1), maxSpoiler: spoiler, relationId },
		});
	if (definition.isPending || query.isPending) return <QueryPending />;
	if (definition.isError)
		return <QueryFailure error={definition.error} retry={() => void definition.refetch()} />;
	if (query.isError) return <QueryFailure error={query.error} retry={() => void query.refetch()} />;
	const rules = valueRules(definition.data);
	return (
		<DefinitionLabelBatch
			ids={query.data.items.flatMap((node) =>
				rules[node.rulePosition]?.vocabularyRevisionId && node.kind === "string" && node.textValue
					? [node.textValue]
					: [],
			)}
		>
			<div className="grid gap-3">
				<dl className="grid gap-3">
					{query.data.items.map((node) => {
						const rule = rules[node.rulePosition];
						return (
							<div key={node.position} className="grid gap-1 rounded border p-3">
								<dt className="text-sm text-muted-foreground">
									{node.position === 0
										? copy.value
										: (node.memberKey ?? `${copy.item} ${node.position}`)}
								</dt>
								<dd className="whitespace-pre-wrap break-words">
									{node.kind === "string" ? (
										rule?.vocabularyRevisionId && node.textValue ? (
											<ExactDefinitionName id={node.textValue} />
										) : (
											node.textValue
										)
									) : node.kind === "number" ? (
										node.numberValue
									) : node.kind === "boolean" ? (
										node.booleanValue ? (
											copy.trueValue
										) : (
											copy.falseValue
										)
									) : node.kind === "null" ? (
										copy.unknown
									) : node.kind === "array" ? (
										copy.list
									) : (
										copy.record
									)}
								</dd>
								{rule?.unit ? <dd className="text-sm text-muted-foreground">{rule.unit}</dd> : null}
							</div>
						);
					})}
				</dl>
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
			</div>
		</DefinitionLabelBatch>
	);
}
