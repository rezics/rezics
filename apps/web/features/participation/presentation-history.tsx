"use client";

import {
	getApiEntitiesByIdProfile,
	useListActingEntityPresentationHistory,
	useGetActingEntityPresentationRevision,
	useRestoreActingEntityPresentation,
	type ClientInstance,
	type GetApiEntitiesByIdProfileStatus200,
} from "@rezics/openapi-tanstack-query";
import { Button, QueryFailure, QueryPending } from "@rezics/ui";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import type { ContentLanguage } from "@rezics/i18n";

export function PresentationHistory({
	client,
	entityId,
	language,
	expectedRevision,
	onRestored,
}: {
	client?: ClientInstance;
	entityId: string;
	language: ContentLanguage;
	expectedRevision: number;
	onRestored: (entity: GetApiEntitiesByIdProfileStatus200) => void;
}) {
	const { t, locale } = useTranslation(["settings", "actions", "ui"]);
	const cache = useQueryClient();
	const [beforeRevision, setBeforeRevision] = useState<number>();
	const [selectedRevision, setSelectedRevision] = useState<number>();
	const authority = JSON.stringify(client?.getConfig().headers ?? null);
	const history = useListActingEntityPresentationHistory(
		{ path: { language }, query: { beforeRevision } },
		{
			client: { client },
			query: {
				queryKey: ["entity-presentation-history", entityId, authority, language, beforeRevision],
			},
		},
	);
	const preview = useGetActingEntityPresentationRevision(
		{ path: { language, revision: selectedRevision ?? 1 } },
		{
			client: { client },
			query: {
				enabled: selectedRevision !== undefined,
				queryKey: ["entity-presentation-revision", entityId, authority, language, selectedRevision],
			},
		},
	);
	const restore = useRestoreActingEntityPresentation({ client: { client } });
	async function restoreRevision() {
		if (selectedRevision === undefined || !preview.data) return;
		try {
			await restore.mutateAsync({
				path: { language },
				body: { revision: selectedRevision, expectedRevision },
			});
			const { data } = await getApiEntitiesByIdProfile({
				path: { id: entityId },
				query: { localizationLanguages: [language] },
			});
			onRestored(data);
			await cache.invalidateQueries();
		} catch {
			/* A stale revision keeps the compared history available for review. */
		}
	}
	if (history.isPending) return <QueryPending />;
	if (history.isError)
		return <QueryFailure error={history.error} retry={() => void history.refetch()} />;
	return (
		<div className="grid gap-3 border-t pt-4">
			{history.data.items.map((item) => (
				<div className="flex justify-between gap-3" key={item.revision}>
					<time dateTime={item.createdAt}>
						{new Intl.DateTimeFormat(locale.target, {
							dateStyle: "medium",
							timeStyle: "short",
						}).format(new Date(item.createdAt))}
					</time>
					<Button variant="outline" onClick={() => setSelectedRevision(item.revision)}>
						{t.actions.view}
					</Button>
				</div>
			))}
			{history.data.nextCursor ? (
				<Button
					variant="quiet"
					onClick={() => setBeforeRevision(history.data.nextCursor ?? undefined)}
				>
					{t.actions.loadMore}
				</Button>
			) : null}
			{selectedRevision !== undefined ? (
				preview.isPending ? (
					<QueryPending />
				) : preview.isError ? (
					<QueryFailure error={preview.error} retry={() => void preview.refetch()} />
				) : (
					<div className="grid gap-2 rounded-lg border p-3">
						<p className="font-medium">{preview.data.name?.value ?? t.ui.unnamed}</p>
						{preview.data.summary ? <p>{preview.data.summary}</p> : null}
						<Button
							variant="outline"
							isLoading={restore.isPending}
							onClick={() => void restoreRevision()}
						>
							{t.settings.participation.restore}
						</Button>
					</div>
				)
			) : null}
			<RequestFailure error={restore.error} />
		</div>
	);
}
