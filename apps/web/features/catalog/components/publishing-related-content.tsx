"use client";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
	useListPublishingConnections,
	useListPublishingComponents,
	usePutPublishingComponent,
	readPublishingDetailsQueryKey,
	listPublishingComponentsQueryKey,
	listPublishingComponentHistoryQueryKey,
	type ReadPublishingDetailsStatus200,
	type ListPublishingConnectionsOptions,
	type ListPublishingComponentsStatus200,
} from "@rezics/openapi-tanstack-query";
import { Button, QueryPending, QueryFailure } from "@rezics/ui";
import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import { AppLink } from "@/features/application-shell/components/app-link";
import { DomainField, optionalText, optionalNumber } from "./domain-field";
import { PublishingHistory, PublishingPageControls } from "./publishing-component-history";

type Details = ReadPublishingDetailsStatus200;
type Connection = NonNullable<ListPublishingConnectionsOptions["query"]>;
type Child = ListPublishingComponentsStatus200["items"][number];
export function PublishingRelatedContent({ data }: { data: Details }) {
	const { t } = useTranslation(["units"]);
	return (
		<>
			{data.structure.shape === "work" ? (
				<>
					<Connections
						id={data.id}
						kind="publication_work"
						direction="incoming"
						title={t.units.nativePublishing.publications}
					/>
					<Connections
						id={data.id}
						kind="text_work"
						direction="incoming"
						title={t.units.nativePublishing.textVersions}
					/>
				</>
			) : data.structure.shape === "text_version" ? (
				<>
					<Connections
						id={data.id}
						kind="text_work"
						direction="outgoing"
						title={t.units.nativePublishing.works}
					/>
					<Connections
						id={data.id}
						kind="publication_text"
						direction="incoming"
						title={t.units.nativePublishing.publications}
					/>
					<Connections
						id={data.id}
						kind="serialization_text"
						direction="incoming"
						title={t.units.nativePublishing.serializations}
					/>
				</>
			) : data.structure.shape === "publication" ? (
				<>
					<Connections
						id={data.id}
						kind="publication_work"
						direction="outgoing"
						title={t.units.nativePublishing.works}
					/>
					<Connections
						id={data.id}
						kind="publication_text"
						direction="outgoing"
						title={t.units.nativePublishing.textVersions}
					/>
					<Children key={`${data.id}:events`} data={data} kind="event" />
				</>
			) : (
				<>
					<Connections
						id={data.id}
						kind="serialization_text"
						direction="outgoing"
						title={t.units.nativePublishing.textVersions}
					/>
					<Children key={`${data.id}:parts`} data={data} kind="installment" />
				</>
			)}
		</>
	);
}
function Connections({
	id,
	kind,
	direction,
	title,
}: {
	id: string;
	kind: Connection["kind"];
	direction: Connection["direction"];
	title: string;
}) {
	const { t } = useTranslation(["ui"]),
		[cursors, setCursors] = useState<string[]>([]);
	const query = useListPublishingConnections({
		path: { id },
		query: { kind, direction, limit: 20, cursor: cursors.at(-1) },
	});
	if (query.isPending) return <QueryPending />;
	if (query.isError) return <QueryFailure error={query.error} retry={() => void query.refetch()} />;
	if (!query.data.items.length && !query.data.nextCursor && !cursors.length) return null;
	return (
		<section className="grid gap-3">
			<h2 className="text-lg font-semibold">{title}</h2>
			<ul className="grid gap-2">
				{query.data.items.map((item) => (
					<li key={item.id}>
						<AppLink
							className="underline underline-offset-4"
							lang={item.name?.languageTag ?? undefined}
							href={`/catalog/publishing/${item.id}`}
						>
							{item.name?.value ?? t.ui.unnamed}
						</AppLink>
						{item.coverageText ? (
							<p className="text-muted-foreground text-sm">{item.coverageText}</p>
						) : null}
					</li>
				))}
			</ul>
			<PublishingPageControls
				cursors={cursors}
				setCursors={setCursors}
				next={query.data.nextCursor}
			/>
		</section>
	);
}
function Children({
	data,
	kind,
	parentId,
	depth = 0,
}: {
	data: Details;
	kind: "event" | "installment";
	parentId?: string;
	depth?: number;
}) {
	const { t } = useTranslation(["units"]),
		[cursors, setCursors] = useState<string[]>([]);
	const query = useListPublishingComponents({
		path: { id: data.id, kind },
		query: { parentId, limit: 20, cursor: cursors.at(-1) },
	});
	if (query.isPending) return <QueryPending />;
	if (query.isError) return <QueryFailure error={query.error} retry={() => void query.refetch()} />;
	if (!query.data.items.length && !query.data.nextCursor && !cursors.length)
		return parentId ? (
			<p className="text-muted-foreground text-sm">{t.units.nativePublishing.noSubparts}</p>
		) : null;
	return (
		<section className="grid gap-3">
			{!parentId ? (
				<h2 className="text-lg font-semibold">
					{kind === "event"
						? t.units.nativePublishing.events
						: t.units.nativePublishing.installments}
				</h2>
			) : null}
			<ol className="grid gap-3">
				{query.data.items.map((item) => (
					<li key={item.id} className="grid gap-2 rounded-lg border p-3">
						<ChildEditor key={item.historyId} data={data} item={item} depth={depth} />
					</li>
				))}
			</ol>
			<PublishingPageControls
				cursors={cursors}
				setCursors={setCursors}
				next={query.data.nextCursor}
			/>
		</section>
	);
}
function ChildEditor({ data, item, depth }: { data: Details; item: Child; depth: number }) {
	const { t } = useTranslation(["units", "ui"]),
		client = useQueryClient();
	const [draft, setDraft] = useState(item.value),
		[editing, setEditing] = useState(false),
		[expanded, setExpanded] = useState(false),
		[history, setHistory] = useState(false);
	const component =
		item.value.kind === "event" ? "publishing_release_event" : "publishing_installment";
	const save = usePutPublishingComponent({
		mutation: {
			onSuccess: async () => {
				await Promise.all([
					client.invalidateQueries({
						queryKey: readPublishingDetailsQueryKey({ path: { id: data.id } }),
					}),
					client.invalidateQueries({
						queryKey: listPublishingComponentsQueryKey({
							path: { id: data.id, kind: item.value.kind },
						}),
					}),
					client.invalidateQueries({
						queryKey: listPublishingComponentHistoryQueryKey({
							path: { id: data.id, component, componentKey: item.id },
						}),
					}),
				]);
				setEditing(false);
			},
		},
	});
	if (draft.kind !== "event" && draft.kind !== "installment") return null;
	const date = [draft.date.year, draft.date.month, draft.date.day]
		.filter((value) => value !== null)
		.join("-");
	return (
		<>
			<div className="grid gap-1">
				<p>
					{draft.kind === "event"
						? (item.name?.value ?? draft.publisherCredit)
						: (draft.label ?? t.ui.unnamed)}
				</p>
				{date ? <p className="text-muted-foreground text-sm">{date}</p> : null}
				{draft.dateText && draft.dateText !== date ? (
					<p className="text-muted-foreground text-sm">{draft.dateText}</p>
				) : null}
			</div>
			{editing ? (
				<form
					className="grid gap-3"
					onSubmit={(event) => {
						event.preventDefault();
						save.mutate({
							path: { id: data.id, kind: draft.kind, componentId: item.id },
							body: {
								expectedRevision: data.revision,
								expectedHistoryId: item.historyId,
								value: draft,
							},
						});
					}}
				>
					<fieldset disabled={save.isPending} className="grid gap-3 sm:grid-cols-2">
						{draft.kind === "event" ? (
							<DomainField
								label={t.units.nativePublishing.publisher}
								value={draft.publisherCredit}
								onChange={(value) => setDraft({ ...draft, publisherCredit: optionalText(value) })}
							/>
						) : (
							<DomainField
								label={t.ui.title}
								value={draft.label}
								onChange={(value) => setDraft({ ...draft, label: optionalText(value) })}
							/>
						)}
						<DomainField
							label={t.units.nativePublishing.dateText}
							value={draft.dateText}
							onChange={(value) => setDraft({ ...draft, dateText: optionalText(value) })}
						/>
						{(["year", "month", "day"] as const).map((field) => (
							<DomainField
								key={field}
								label={t.units.nativeDomain[field]}
								value={draft.date[field]}
								numeric
								onChange={(value) =>
									setDraft({ ...draft, date: { ...draft.date, [field]: optionalNumber(value) } })
								}
							/>
						))}
					</fieldset>
					<RequestFailure error={save.error} />
					<div className="flex gap-2">
						<Button type="submit" disabled={save.isPending}>
							{t.ui.save}
						</Button>
						<Button
							type="button"
							variant="outline"
							disabled={save.isPending}
							onClick={() => {
								setDraft(item.value);
								setEditing(false);
							}}
						>
							{t.units.nativeDomain.cancel}
						</Button>
					</div>
				</form>
			) : null}
			<div className="flex gap-2">
				{data.canEdit ? (
					<>
						<Button variant="outline" onClick={() => setEditing(!editing)}>
							{t.ui.edit}
						</Button>
						<Button variant="outline" aria-expanded={history} onClick={() => setHistory(!history)}>
							{t.units.nativeDomain.history}
						</Button>
					</>
				) : null}
				{draft.kind === "installment" && depth < 63 ? (
					<Button variant="outline" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>
						{expanded ? t.ui.showLess : t.ui.showMore}
					</Button>
				) : null}
			</div>
			{history ? (
				<PublishingHistory
					data={data}
					component={component}
					componentKey={item.id}
					currentHistoryId={item.historyId}
				/>
			) : null}
			{expanded && draft.kind === "installment" ? (
				<Children data={data} kind="installment" parentId={item.id} depth={depth + 1} />
			) : null}
		</>
	);
}
