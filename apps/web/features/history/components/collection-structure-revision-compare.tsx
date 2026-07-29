"use client";

import { useGetApiCollectionsByCollectionIdItemRevisionsCompare } from "@rezics/openapi-tanstack-query";
import { Card, CardContent, CardHeader, CardTitle, QueryFailure, QueryPending } from "@rezics/ui";

import { useTranslation } from "@/i18n/client";

export function CollectionStructureRevisionCompare({
	collectionId,
	from,
	to,
}: {
	readonly collectionId: string;
	readonly from: string;
	readonly to: string;
}) {
	const { t } = useTranslation(["history"]);
	const compare = useGetApiCollectionsByCollectionIdItemRevisionsCompare({
		path: { collectionId },
		query: { from, to },
	});
	if (compare.isError)
		return <QueryFailure error={compare.error} retry={() => void compare.refetch()} />;
	if (!compare.data) return <QueryPending />;
	return (
		<div className="grid gap-3">
			{compare.data.changes.map((change) => (
				<Card appearance="outlined" key={change.path}>
					<CardHeader>
						<CardTitle className="font-mono text-sm">{change.path}</CardTitle>
					</CardHeader>
					<CardContent className="grid gap-4 md:grid-cols-2">
						<RevisionValue label={t.history.before} value={change.before} />
						<RevisionValue label={t.history.after} value={change.after} />
					</CardContent>
				</Card>
			))}
		</div>
	);
}

function RevisionValue({ label, value }: { readonly label: string; readonly value: unknown }) {
	return (
		<section className="min-w-0">
			<h3 className="mb-2 text-sm font-semibold">{label}</h3>
			<pre className="max-h-96 overflow-auto rounded-md bg-muted p-3 text-xs">
				{JSON.stringify(value, null, 2)}
			</pre>
		</section>
	);
}
