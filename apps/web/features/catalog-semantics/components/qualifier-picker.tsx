"use client";
import { useState } from "react";
import type { CatalogReference } from "@rezics/reference";
import { useListCatalogFacts } from "@rezics/openapi-tanstack-query";
import { Button, QueryFailure, QueryPending } from "@rezics/ui";
import { useTranslation } from "@/i18n/client";
import { FactValue } from "./fact-value";
export function QualifierPicker({
	reference,
	definitionRevisionId,
	spoiler,
	onPick,
}: {
	reference: CatalogReference;
	definitionRevisionId: string;
	spoiler: 0 | 1 | 2;
	onPick: (factId: string) => void;
}) {
	const { t } = useTranslation(["units", "ui", "actions"]),
		copy = t.units.nativeSemantics;
	const [cursors, setCursors] = useState<string[]>([]),
		[preview, setPreview] = useState<string>();
	const query = useListCatalogFacts({
		path: reference,
		query: { definitionRevisionId, maxSpoiler: spoiler, limit: 25, afterId: cursors.at(-1) },
	});
	if (query.isPending) return <QueryPending />;
	if (query.isError) return <QueryFailure error={query.error} retry={() => void query.refetch()} />;
	return (
		<div className="grid gap-3">
			{query.data.items.length ? (
				query.data.items.map((fact, index) => (
					<section key={fact.id} className="grid gap-2 rounded border p-3">
						<Button
							type="button"
							variant="outline"
							aria-expanded={preview === fact.id}
							onClick={() => setPreview((current) => (current === fact.id ? undefined : fact.id))}
						>
							{copy.inspectValue} {index + 1}
						</Button>
						{preview === fact.id ? (
							<>
								<FactValue
									reference={reference}
									factId={fact.id}
									definitionRevisionId={fact.definitionRevisionId}
									spoiler={spoiler}
								/>
								<Button type="button" onClick={() => onPick(fact.id)}>
									{copy.useValue}
								</Button>
							</>
						) : null}
					</section>
				))
			) : (
				<p>{copy.noMatchingValues}</p>
			)}
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
		</div>
	);
}
