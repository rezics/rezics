"use client";

import {
	useGetApiFavoritesByTargetUnitIdHistory,
	useGetApiFavoritesByTargetUnitIdHistoryByRevision,
	usePostApiFavoritesByTargetUnitIdRestore,
} from "@rezics/openapi-tanstack-query";
import { Button, QueryFailure, QueryPending } from "@rezics/ui";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import { invalidateFavorites } from "./favorite-cache";

export function FavoriteHistory({
	targetUnitId,
	revision,
	onChanged,
}: {
	targetUnitId: string;
	revision: number;
	onChanged?: () => void;
}) {
	const { t, locale } = useTranslation(["collections", "actions", "ui"]);
	const client = useQueryClient();
	const [beforeRevision, setBeforeRevision] = useState<number>();
	const [selectedRevision, setSelectedRevision] = useState<number>();
	const history = useGetApiFavoritesByTargetUnitIdHistory({
		path: { targetUnitId },
		query: { beforeRevision },
	});
	const preview = useGetApiFavoritesByTargetUnitIdHistoryByRevision(
		{ path: { targetUnitId, revision: selectedRevision ?? 1 } },
		{ query: { enabled: selectedRevision !== undefined } },
	);
	const restore = usePostApiFavoritesByTargetUnitIdRestore();
	async function restoreRevision() {
		if (!preview.data?.snapshot || selectedRevision === undefined) return;
		try {
			await restore.mutateAsync({
				path: { targetUnitId },
				body: { revision: selectedRevision, expectedRevision: revision },
			});
			onChanged?.();
			await invalidateFavorites(client);
		} catch {
			await invalidateFavorites(client);
		}
	}
	if (history.isPending) return <QueryPending />;
	if (history.isError)
		return <QueryFailure error={history.error} retry={() => void history.refetch()} />;
	return (
		<div className="grid gap-3">
			{!history.data.items.length ? (
				<p>{t.collections.privateFavorites.empty}</p>
			) : (
				history.data.items.map((item) => (
					<div className="flex items-center justify-between gap-3" key={item.revision}>
						<time dateTime={item.createdAt}>
							{new Intl.DateTimeFormat(locale.target, {
								dateStyle: "medium",
								timeStyle: "short",
							}).format(new Date(item.createdAt))}
						</time>
						<span className="text-sm">
							{item.operation === "delete"
								? t.collections.privateFavorites.remove
								: item.operation === "restore"
									? t.collections.privateFavorites.restore
									: item.operation === "save"
										? t.ui.saved
										: t.ui.edit}
						</span>
						<Button variant="outline" onClick={() => setSelectedRevision(item.revision)}>
							{t.actions.view}
						</Button>
					</div>
				))
			)}
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
					<div className="grid gap-3 rounded-lg border p-3">
						{preview.data.snapshot ? (
							<>
								<p className="font-medium">{preview.data.snapshot.preview.title ?? t.ui.unnamed}</p>
								{preview.data.snapshot.preview.summary ? (
									<p>{preview.data.snapshot.preview.summary}</p>
								) : null}
								<p className="whitespace-pre-wrap">{preview.data.snapshot.note}</p>
								<Button
									variant="outline"
									isLoading={restore.isPending}
									onClick={() => void restoreRevision()}
								>
									{t.collections.privateFavorites.restore}
								</Button>
							</>
						) : (
							<p>{t.collections.privateFavorites.remove}</p>
						)}
					</div>
				)
			) : null}
			<RequestFailure error={restore.error} />
		</div>
	);
}
