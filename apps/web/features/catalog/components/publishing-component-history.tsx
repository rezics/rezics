"use client";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
	useListPublishingComponentHistory,
	useRestorePublishingComponent,
	readPublishingDetailsQueryKey,
	listPublishingComponentHistoryQueryKey,
	listPublishingComponentsQueryKey,
	readCatalogResourceQueryKey,
	type ReadPublishingDetailsStatus200,
	type ListPublishingComponentHistoryStatus200,
} from "@rezics/openapi-tanstack-query";
import { Button, QueryPending, QueryFailure } from "@rezics/ui";
import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
type Details = ReadPublishingDetailsStatus200;
type HistoryItem = ListPublishingComponentHistoryStatus200["items"][number];
export function PublishingHistory({
	data,
	component,
	componentKey,
	currentHistoryId,
}: {
	data: Details;
	component: HistoryItem["component"];
	componentKey: string;
	currentHistoryId: string;
}) {
	const { t, locale } = useTranslation(["units", "ui"]),
		client = useQueryClient(),
		[cursors, setCursors] = useState<string[]>([]);
	const path = { id: data.id, component, componentKey };
	const query = useListPublishingComponentHistory({
		path,
		query: { limit: 20, cursor: cursors.at(-1) },
	});
	const restore = useRestorePublishingComponent({
		mutation: {
			onSuccess: () =>
				Promise.all([
					client.invalidateQueries({
						queryKey: readPublishingDetailsQueryKey({ path: { id: data.id } }),
					}),
					client.invalidateQueries({ queryKey: listPublishingComponentHistoryQueryKey({ path }) }),
					...(
						[
							"text_work",
							"publication_text",
							"publication_work",
							"facet",
							"event",
							"installment",
						] as const
					).map((kind) =>
						client.invalidateQueries({
							queryKey: listPublishingComponentsQueryKey({ path: { id: data.id, kind } }),
						}),
					),
					client.invalidateQueries({
						queryKey: readCatalogResourceQueryKey({ path: { owner: "publishing", id: data.id } }),
					}),
				]),
		},
	});
	if (query.isPending) return <QueryPending />;
	if (query.isError) return <QueryFailure error={query.error} retry={() => void query.refetch()} />;
	return (
		<div className="grid gap-3">
			<ol className="grid gap-3">
				{query.data.items.map((item) => (
					<li key={item.id} className="grid gap-2">
						<details>
							<summary className="cursor-pointer">
								<time dateTime={item.recordedAt}>
									{new Date(item.recordedAt).toLocaleString(locale.target)}
								</time>
								{item.operation === "DELETE" ? ` · ${t.units.nativePublishing.removed}` : null}
							</summary>
							<HistoryPreview item={item} />
						</details>
						<Button
							variant="outline"
							disabled={restore.isPending || item.id === currentHistoryId}
							onClick={() =>
								restore.mutate({
									path,
									body: {
										expectedRevision: data.revision,
										expectedHistoryId: currentHistoryId,
										historyId: item.id,
									},
								})
							}
						>
							{t.units.nativeDomain.restore}
						</Button>
					</li>
				))}
			</ol>
			<RequestFailure error={restore.error} />
			<PublishingPageControls
				cursors={cursors}
				setCursors={setCursors}
				next={query.data.nextCursor}
			/>
		</div>
	);
}
function HistoryPreview({ item }: { item: HistoryItem }) {
	const { t } = useTranslation(["units"]),
		snapshot = item.snapshot;
	if (snapshot.kind === "structure")
		return snapshot.value.shape === "publication" ? (
			<dl className="grid gap-2 py-2">
				<div>
					<dt>{t.units.nativePublishing.pageCount}</dt>
					<dd>{snapshot.value.fields.pageCount ?? t.units.nativeDomain.unknown}</dd>
				</div>
				<div>
					<dt>{t.units.nativePublishing.pagination}</dt>
					<dd>{snapshot.value.fields.paginationText ?? t.units.nativeDomain.unknown}</dd>
				</div>
			</dl>
		) : snapshot.value.shape === "text_version" ? (
			<p className="py-2">{snapshot.value.fields.languageTag ?? t.units.nativeDomain.unknown}</p>
		) : null;
	const value = snapshot.value;
	return (
		<p className="whitespace-pre-wrap py-2">
			{value.kind === "event"
				? [
						value.publisherCredit,
						value.dateText ??
							[value.date.year, value.date.month, value.date.day]
								.filter((item) => item !== null)
								.join("-"),
					]
						.filter(Boolean)
						.join(" · ")
				: value.kind === "installment"
					? [value.label, value.dateText].filter(Boolean).join(" · ")
					: "coverageText" in value
						? value.coverageText
						: null}
		</p>
	);
}
export function PublishingPageControls({
	cursors,
	setCursors,
	next,
}: {
	cursors: string[];
	setCursors: (value: string[]) => void;
	next: string | null;
}) {
	const { t } = useTranslation(["ui", "actions"]);
	return (
		<div className="flex gap-2">
			{cursors.length ? (
				<Button variant="outline" onClick={() => setCursors(cursors.slice(0, -1))}>
					{t.ui.shelf.previous}
				</Button>
			) : null}
			{next ? (
				<Button variant="outline" onClick={() => setCursors([...cursors, next])}>
					{t.actions.loadMore}
				</Button>
			) : null}
		</div>
	);
}
