"use client";

import { AppLink } from "@/features/application-shell/components/app-link";
import { RequireSession } from "@/features/auth/require-session";
import { publicUnitHref } from "@/features/units/routing/public-unit-route";
import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import {
	useDeleteApiFavoritesByTargetUnitId,
	useGetApiFavorites,
	usePutApiFavoritesByTargetUnitId,
	type GetApiFavoritesStatus200,
} from "@rezics/openapi-tanstack-query";
import {
	Button,
	Card,
	CardContent,
	Field,
	FieldLabel,
	PageHeading,
	QueryFailure,
	QueryPending,
	Textarea,
} from "@rezics/ui";
import { useQueryClient } from "@tanstack/react-query";
import { useId, useState } from "react";
import { invalidateFavorites } from "./favorite-cache";
import { FavoriteHistory } from "./favorite-history";

export function FavoritesPage() {
	return (
		<RequireSession>
			<FavoritesContent />
		</RequireSession>
	);
}

function FavoritesContent() {
	const { t } = useTranslation(["collections", "actions", "ui"]);
	const [cursors, setCursors] = useState<string[]>([]);
	const query = useGetApiFavorites({ query: { limit: 30, afterPosition: cursors.at(-1) } });
	if (query.isPending) return <QueryPending />;
	if (query.isError) return <QueryFailure error={query.error} retry={() => void query.refetch()} />;
	return (
		<main className="mx-auto grid w-full max-w-3xl gap-6 px-4 py-8">
			<PageHeading
				title={t.collections.favorites}
				description={t.collections.privateFavorites.privacy}
			/>
			{query.data.items.length ? (
				query.data.items.map((entry) => (
					<FavoriteEntry
						key={`${entry.targetUnitId}:${entry.revision}`}
						entry={entry}
						revision={query.data.revision}
						onChanged={() => setCursors([])}
					/>
				))
			) : (
				<p>{t.collections.privateFavorites.empty}</p>
			)}
			<div className="flex gap-3">
				{cursors.length ? (
					<Button variant="outline" onClick={() => setCursors((current) => current.slice(0, -1))}>
						{t.ui.shelf.previous}
					</Button>
				) : null}
				{query.data.nextCursor ? (
					<Button
						variant="outline"
						onClick={() => {
							const next = query.data.nextCursor;
							if (next) setCursors((current) => [...current, next]);
						}}
					>
						{t.actions.loadMore}
					</Button>
				) : null}
			</div>
		</main>
	);
}

type Entry = GetApiFavoritesStatus200["items"][number];

function FavoriteEntry({
	entry,
	revision,
	onChanged,
}: {
	entry: Entry;
	revision: number;
	onChanged: () => void;
}) {
	const { t } = useTranslation(["collections", "ui"]);
	const client = useQueryClient();
	const noteId = useId();
	const [note, setNote] = useState(entry.note ?? "");
	const [history, setHistory] = useState(false);
	const save = usePutApiFavoritesByTargetUnitId();
	const remove = useDeleteApiFavoritesByTargetUnitId();
	const pending = save.isPending || remove.isPending;
	async function mutate(operation: "save" | "remove" | "refresh" | "first") {
		try {
			if (operation === "remove")
				await remove.mutateAsync({
					path: { targetUnitId: entry.targetUnitId },
					body: { expectedRevision: revision },
				});
			else
				await save.mutateAsync({
					path: { targetUnitId: entry.targetUnitId },
					body: {
						expectedRevision: revision,
						note: note || null,
						...(operation === "refresh" ? { refreshPreview: true } : {}),
						...(operation === "first" ? { afterTargetId: null } : {}),
					},
				});
			onChanged();
			await invalidateFavorites(client);
		} catch {
			await invalidateFavorites(client);
		}
	}
	const href = publicUnitHref(entry.preview.kind, { id: entry.targetUnitId });
	return (
		<Card>
			<CardContent className="grid gap-4 p-5">
				<h2 className="font-semibold">
					{href ? (
						<AppLink href={href}>{entry.preview.title ?? t.ui.unnamed}</AppLink>
					) : (
						(entry.preview.title ?? t.ui.unnamed)
					)}
				</h2>
				{entry.preview.summary ? (
					<p className="text-muted-foreground text-sm">{entry.preview.summary}</p>
				) : null}
				<Field>
					<FieldLabel htmlFor={noteId}>{t.collections.privateFavorites.note}</FieldLabel>
					<Textarea
						id={noteId}
						maxLength={65536}
						value={note}
						onChange={(event) => setNote(event.currentTarget.value)}
					/>
				</Field>
				<div className="flex flex-wrap gap-2">
					<Button
						disabled={pending || note === (entry.note ?? "")}
						onClick={() => void mutate("save")}
					>
						{t.ui.save}
					</Button>
					<Button variant="outline" disabled={pending} onClick={() => void mutate("refresh")}>
						{t.collections.privateFavorites.refreshPreview}
					</Button>
					<Button variant="outline" disabled={pending} onClick={() => void mutate("first")}>
						{t.collections.privateFavorites.moveFirst}
					</Button>
					<Button variant="outline" disabled={pending} onClick={() => void mutate("remove")}>
						{t.collections.privateFavorites.remove}
					</Button>
					<Button
						variant="quiet"
						onClick={() => setHistory((current) => !current)}
						aria-expanded={history}
					>
						{t.collections.privateFavorites.history}
					</Button>
				</div>
				<RequestFailure error={save.error ?? remove.error} />
				{history ? (
					<FavoriteHistory
						targetUnitId={entry.targetUnitId}
						revision={revision}
						onChanged={onChanged}
					/>
				) : null}
			</CardContent>
		</Card>
	);
}
