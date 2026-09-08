"use client";
import { useState } from "react";
import { useListContentReviewCaseNotes } from "@rezics/openapi-tanstack-query";
import { Button, QueryFailure, QueryPending } from "@rezics/ui";
import { LocalizedPortableTextContent } from "@/features/content-language-display/localized-portable-text-content";
import { useTranslation } from "@/i18n/client";
import { readPortableText } from "@/lib/block";

export function ContentReviewCaseNotes({ caseId }: { caseId: string }) {
	const { t } = useTranslation(["console", "realms", "ui", "actions", "locale"]);
	const [cursors, setCursors] = useState<string[]>([]);
	const query = useListContentReviewCaseNotes({
		path: { caseId },
		query: { limit: 20, cursor: cursors.at(-1) },
	});
	if (query.isPending) return <QueryPending />;
	if (query.isError) return <QueryFailure error={query.error} retry={() => void query.refetch()} />;
	if (!query.data.items.length && !cursors.length) return null;
	return (
		<section className="grid gap-3">
			<h3 className="font-medium">{t.console.caseNotes}</h3>
			{query.data.items.map((note) => (
				<article
					key={`${note.postId}:${note.latestRevisionId ?? "current"}:${note.role}`}
					className="grid gap-2 rounded border p-3"
				>
					<p className="text-sm text-muted-foreground">
						{t.realms.annotationRoleLanguage({
							role: t.realms.annotationRoles[note.role],
							language: t.locale.contentLanguages[note.language],
						})}
					</p>
					<LocalizedPortableTextContent
						language={note.language}
						value={readPortableText(note.content)}
						variant="compact"
					/>
					{note.latestRevisionId ? (
						<details className="text-xs">
							<summary>{t.realms.annotationRevision}</summary>
							<code>{note.latestRevisionId}</code>
						</details>
					) : null}
				</article>
			))}
			<div className="flex gap-2">
				{cursors.length ? (
					<Button variant="outline" onClick={() => setCursors((value) => value.slice(0, -1))}>
						{t.ui.shelf.previous}
					</Button>
				) : null}
				{query.data.nextCursor ? (
					<Button
						variant="outline"
						onClick={() => {
							const next = query.data.nextCursor;
							if (next) setCursors((value) => [...value, next]);
						}}
					>
						{t.actions.loadMore}
					</Button>
				) : null}
			</div>
		</section>
	);
}
