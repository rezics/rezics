"use client";
import { useState } from "react";
import { generateKeyBetween } from "fractional-indexing";
import {
	useListGroupingOrderProfiles,
	useCreateGroupingOrderProfile,
	useRenameGroupingOrderProfile,
	useListGroupingOrderEntries,
	usePutGroupingOrderEntry,
	useRemoveGroupingOrderEntry,
	useListCatalogRelations,
} from "@rezics/openapi-tanstack-query";
import type { ListGroupingOrderProfilesStatus200 } from "@rezics/openapi-tanstack-query";
import { Button, QueryFailure, QueryPending } from "@rezics/ui";
import {
	DefinitionText,
	DefinitionChoice,
} from "@/features/catalog-definitions/components/definition-fields";
import {
	DefinitionLabelBatch,
	ExactDefinitionName,
} from "@/features/catalog-semantics/components/definition-revision-options";
import { RelationValue } from "@/features/catalog-semantics/components/relation-value";
import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import { GroupingPager, type GroupingEditContext } from "./grouping-page-controls";
type Order = ListGroupingOrderProfilesStatus200["items"][number];
export function GroupingOrders(context: GroupingEditContext) {
	const { t } = useTranslation(["units", "actions"]),
		[cursors, setCursors] = useState<string[]>([]),
		[name, setName] = useState(""),
		[selected, setSelected] = useState<Order>();
	const query = useListGroupingOrderProfiles({
			path: { id: context.id },
			query: { limit: 25, cursor: cursors.at(-1) },
		}),
		create = useCreateGroupingOrderProfile();
	if (query.isPending) return <QueryPending />;
	if (query.isError) return <QueryFailure error={query.error} retry={() => void query.refetch()} />;
	return (
		<section className="grid gap-3">
			<h3 className="font-semibold">{t.units.nativeGrouping.orders}</h3>
			<div className="flex flex-wrap gap-2">
				{query.data.items.map((item) => (
					<Button
						key={item.id}
						variant={item.id === selected?.id ? "solid" : "outline"}
						onClick={() => setSelected(item)}
					>
						{item.key}
					</Button>
				))}
			</div>
			<GroupingPager
				previous={Boolean(cursors.length)}
				next={Boolean(query.data.nextCursor)}
				onPrevious={() => setCursors((value) => value.slice(0, -1))}
				onNext={() => {
					const next = query.data.nextCursor;
					if (next) setCursors((value) => [...value, next]);
				}}
			/>
			{context.canEdit ? (
				<>
					<DefinitionText
						label={t.units.nativeGrouping.orderName}
						value={name}
						onChange={setName}
					/>
					<Button
						disabled={!name.trim() || create.isPending}
						onClick={() => {
							void create
								.mutateAsync({
									path: { id: context.id },
									body: { expectedRevision: context.revision, key: name.trim() },
								})
								.then((result) => {
									context.onChanged();
									void query.refetch();
									setSelected({ id: result.id, key: name.trim() });
									setName("");
								})
								.catch(() => undefined);
						}}
					>
						{t.actions.create}
					</Button>
				</>
			) : null}
			<RequestFailure error={create.error} />
			{selected ? (
				<OrderEntries
					key={selected.id}
					context={context}
					order={selected}
					onRename={(key) => {
						setSelected({ ...selected, key });
						void query.refetch();
					}}
				/>
			) : null}
		</section>
	);
}
function OrderEntries({
	context,
	order,
	onRename,
}: {
	context: GroupingEditContext;
	order: Order;
	onRename: (key: string) => void;
}) {
	const { t } = useTranslation(["units", "ui"]),
		copy = t.units.nativeGrouping;
	const [cursors, setCursors] = useState<string[]>([]),
		[name, setName] = useState(order.key),
		[spoiler, setSpoiler] = useState<0 | 1 | 2>(0),
		[adding, setAdding] = useState(false),
		[expanded, setExpanded] = useState<string>();
	const path = { id: context.id, profileId: order.id },
		reference = { owner: "grouping" as const, id: context.id };
	const query = useListGroupingOrderEntries({
			path,
			query: { limit: 25, cursor: cursors.at(-1), maxSpoiler: spoiler },
		}),
		update = usePutGroupingOrderEntry(),
		remove = useRemoveGroupingOrderEntry(),
		rename = useRenameGroupingOrderProfile();
	const changed = () => {
		context.onChanged();
		void query.refetch();
	};
	if (query.isPending) return <QueryPending />;
	if (query.isError) return <QueryFailure error={query.error} retry={() => void query.refetch()} />;
	return (
		<section className="grid gap-3 rounded border p-3">
			{context.canEdit ? (
				<>
					<DefinitionText label={copy.orderName} value={name} onChange={setName} />
					<Button
						variant="outline"
						disabled={!name.trim() || rename.isPending || name.trim() === order.key}
						onClick={() => {
							void rename
								.mutateAsync({
									path,
									body: { expectedRevision: context.revision, key: name.trim() },
								})
								.then(() => {
									context.onChanged();
									onRename(name.trim());
								})
								.catch(() => undefined);
						}}
					>
						{t.ui.save}
					</Button>
				</>
			) : (
				<h4>{order.key}</h4>
			)}
			<DefinitionChoice
				label={t.units.nativeSemantics.spoilerVisibility}
				value={String(spoiler)}
				values={["0", "1", "2"]}
				labelFor={(value) =>
					value === "0"
						? t.units.nativeSemantics.spoilerNone
						: value === "1"
							? t.units.nativeSemantics.spoilerMinor
							: t.units.nativeSemantics.spoilerMajor
				}
				onChange={(value) => {
					setSpoiler(value === "0" ? 0 : value === "1" ? 1 : 2);
					setCursors([]);
					setExpanded(undefined);
				}}
			/>
			{query.data.items.map((item, index) => (
				<article key={item.relationId} className="grid gap-2 rounded border p-3">
					<Button
						variant="quiet"
						aria-expanded={expanded === item.relationId}
						onClick={() =>
							setExpanded((value) => (value === item.relationId ? undefined : item.relationId))
						}
					>
						{copy.membership} {index + 1}
					</Button>
					{expanded === item.relationId ? (
						<RelationValue reference={reference} relationId={item.relationId} spoiler={spoiler} />
					) : null}
					{item.sourcePosition ? (
						<p>
							{copy.sourcePosition}: {item.sourcePosition}
						</p>
					) : null}
					{context.canEdit ? (
						<div className="flex flex-wrap gap-2">
							{index > 0 ? (
								<Button
									variant="outline"
									disabled={update.isPending}
									onClick={() => {
										const previous = query.data.items[index - 1];
										if (!previous) return;
										void update
											.mutateAsync({
												path: { ...path, relationId: item.relationId },
												body: {
													expectedRevision: context.revision,
													position: generateKeyBetween(
														query.data.items[index - 2]?.position ?? null,
														previous.position,
													),
													...(item.sourcePosition ? { sourcePosition: item.sourcePosition } : {}),
												},
											})
											.then(changed)
											.catch(() => undefined);
									}}
								>
									{copy.moveEarlier}
								</Button>
							) : null}
							<Button
								variant="outline"
								disabled={remove.isPending}
								onClick={() => {
									void remove
										.mutateAsync({
											path: { ...path, relationId: item.relationId },
											body: { expectedRevision: context.revision },
										})
										.then(changed)
										.catch(() => undefined);
								}}
							>
								{copy.removeOrderEntry}
							</Button>
						</div>
					) : null}
				</article>
			))}
			<GroupingPager
				previous={Boolean(cursors.length)}
				next={Boolean(query.data.nextCursor)}
				onPrevious={() => setCursors((value) => value.slice(0, -1))}
				onNext={() => {
					const next = query.data.nextCursor;
					if (next) setCursors((value) => [...value, next]);
				}}
			/>
			{context.canEdit ? (
				<>
					<Button
						variant="outline"
						aria-expanded={adding}
						onClick={() => setAdding((value) => !value)}
					>
						{copy.addMembership}
					</Button>
					{adding ? (
						<GroupingRelationChoices
							context={context}
							spoiler={spoiler}
							disabled={update.isPending}
							onPick={(relationId) => {
								void update
									.mutateAsync({
										path: { ...path, relationId },
										body: {
											expectedRevision: context.revision,
											position: generateKeyBetween(query.data.items.at(-1)?.position ?? null, null),
										},
									})
									.then(() => {
										setAdding(false);
										changed();
									})
									.catch(() => undefined);
							}}
						/>
					) : null}
				</>
			) : null}
			<RequestFailure error={update.error ?? remove.error ?? rename.error} />
		</section>
	);
}
function GroupingRelationChoices({
	context,
	spoiler,
	disabled,
	onPick,
}: {
	context: GroupingEditContext;
	spoiler: 0 | 1 | 2;
	disabled: boolean;
	onPick: (id: string) => void;
}) {
	const { t } = useTranslation(["units"]),
		[cursors, setCursors] = useState<string[]>([]),
		[expanded, setExpanded] = useState<string>(),
		reference = { owner: "grouping" as const, id: context.id };
	const query = useListCatalogRelations({
		path: reference,
		query: { limit: 25, afterId: cursors.at(-1), maxSpoiler: spoiler },
	});
	if (query.isPending) return <QueryPending />;
	if (query.isError) return <QueryFailure error={query.error} retry={() => void query.refetch()} />;
	return (
		<DefinitionLabelBatch ids={query.data.items.map((item) => item.definitionRevisionId)}>
			{query.data.items.map((item) => (
				<article key={item.id} className="grid gap-3 rounded border p-3">
					<ExactDefinitionName id={item.definitionRevisionId} />
					<Button
						variant="outline"
						aria-expanded={expanded === item.id}
						onClick={() => setExpanded((value) => (value === item.id ? undefined : item.id))}
					>
						{t.units.nativeSemantics.inspectValue}
					</Button>
					{expanded === item.id ? (
						<RelationValue reference={reference} relationId={item.id} spoiler={spoiler} />
					) : null}
					<Button disabled={disabled} onClick={() => onPick(item.id)}>
						{t.units.nativeGrouping.addMembership}
					</Button>
				</article>
			))}
			<GroupingPager
				previous={Boolean(cursors.length)}
				next={Boolean(query.data.afterId)}
				onPrevious={() => setCursors((value) => value.slice(0, -1))}
				onNext={() => {
					const next = query.data.afterId;
					if (next) setCursors((value) => [...value, next]);
				}}
			/>
		</DefinitionLabelBatch>
	);
}
