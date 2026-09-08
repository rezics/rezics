"use client";
import {
	useListMusicHistory,
	useRestoreMusicComponent,
	type ListMusicHistoryOptions,
} from "@rezics/openapi-tanstack-query";
import { Button, QueryFailure, QueryPending } from "@rezics/ui";
import { useState } from "react";
import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";

type Props = {
	id: string;
	component: NonNullable<ListMusicHistoryOptions["query"]>["component"];
	componentKey: string;
	expectedRevision: number;
	expectedHeadId: string;
	refresh: () => Promise<void>;
};
export function MusicHistory(props: Props) {
	const { t } = useTranslation(["units"]);
	const [open, setOpen] = useState(false);
	return (
		<div className="grid gap-3">
			<Button variant="quiet" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
				{t.units.nativeMusic.history}
			</Button>
			{open ? <HistoryEntries {...props} /> : null}
		</div>
	);
}
function HistoryEntries({
	id,
	component,
	componentKey,
	expectedRevision,
	expectedHeadId,
	refresh,
}: Props) {
	const { t, locale } = useTranslation(["units", "ui", "actions"]);
	const [cursors, setCursors] = useState<string[]>([]);
	const query = useListMusicHistory({
		path: { id },
		query: { component, componentKey, afterId: cursors.at(-1), limit: 25 },
	});
	const restore = useRestoreMusicComponent();
	async function apply(historyId: string) {
		try {
			await restore.mutateAsync({
				path: { id },
				body: { component, componentKey, expectedRevision, expectedHeadId, historyId },
			});
			await refresh();
			await query.refetch();
		} catch {
			/* Preserve the comparison on conflict. */
		}
	}
	if (query.isPending) return <QueryPending />;
	if (query.isError) return <QueryFailure error={query.error} retry={() => void query.refetch()} />;
	const labels = t.units.nativeMusic;
	return (
		<div className="grid gap-3 rounded-lg border p-3">
			{query.data.items.map((item) => (
				<div key={item.id} className="grid gap-2 border-b pb-3 last:border-0">
					<time dateTime={item.recordedAt}>
						{new Intl.DateTimeFormat(locale.target, {
							dateStyle: "medium",
							timeStyle: "short",
						}).format(new Date(item.recordedAt))}
					</time>
					<dl className="grid gap-1">
						{(
							[
								["name", t.ui.title],
								["number", labels.number],
								["position", labels.position],
								["barcode", labels.barcode],
								["language_tag", labels.language],
								["script_code", labels.script],
								["length_milliseconds", labels.duration],
							] as const
						).map(([key, label]) => {
							const value = item.value[key];
							return typeof value === "string" || typeof value === "number" ? (
								<div key={key}>
									<dt className="text-muted-foreground">{label}</dt>
									<dd className="break-words">{value}</dd>
								</div>
							) : null;
						})}
					</dl>
					{item.operation === "DELETE" ? <p>{labels.deleted}</p> : null}
					{item.id === expectedHeadId ? (
						<span>{labels.current}</span>
					) : item.restorable ? (
						<Button
							variant="outline"
							isLoading={restore.isPending}
							onClick={() => void apply(item.id)}
						>
							{labels.restore}
						</Button>
					) : null}
				</div>
			))}
			<RequestFailure error={restore.error} />
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
		</div>
	);
}
