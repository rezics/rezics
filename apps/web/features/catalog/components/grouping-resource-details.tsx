"use client";
import { useState } from "react";
import {
	useReadCatalogResource,
	useListGroupingClasses,
	useAssignGroupingClass,
	useRemoveGroupingClass,
	useListGroupingHistory,
	useRestoreGroupingCommand,
} from "@rezics/openapi-tanstack-query";
import { Button, QueryFailure, QueryPending } from "@rezics/ui";
import { AppLink } from "@/features/application-shell/components/app-link";
import { DefinitionSelect } from "@/features/catalog-definitions/components/definition-select";
import type { DefinitionSelection } from "@/features/catalog-definitions/model/definition-draft";
import {
	DefinitionLabelBatch,
	ExactDefinitionName,
} from "@/features/catalog-semantics/components/definition-revision-options";
import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import { GroupingOrders } from "./grouping-orders";

import { GroupingPager, type GroupingEditContext } from "./grouping-page-controls";
export function GroupingResourceDetails({ id }: { id: string }) {
	const { t } = useTranslation(["units"]),
		[history, setHistory] = useState(false);
	const resource = useReadCatalogResource({ path: { owner: "grouping", id } });
	if (resource.isPending) return <QueryPending />;
	if (resource.isError)
		return <QueryFailure error={resource.error} retry={() => void resource.refetch()} />;
	const context: GroupingEditContext = {
		id,
		revision: resource.data.revision,
		canEdit: resource.data.canEdit,
		onChanged: () => {
			void resource.refetch();
		},
	};
	return (
		<section className="grid gap-5">
			<GroupingClasses {...context} />
			<GroupingOrders {...context} />
			<Button asChild variant="outline">
				<AppLink href={`/catalog/grouping/${id}/facts`}>
					{t.units.nativeGrouping.editMemberships}
				</AppLink>
			</Button>
			{context.canEdit ? (
				<>
					<Button
						variant="outline"
						aria-expanded={history}
						onClick={() => setHistory((value) => !value)}
					>
						{t.units.nativeSemantics.history}
					</Button>
					{history ? <GroupingHistory {...context} /> : null}
				</>
			) : null}
		</section>
	);
}

function GroupingClasses(context: GroupingEditContext) {
	const { t } = useTranslation(["units", "ui"]),
		[cursors, setCursors] = useState<string[]>([]),
		[selected, setSelected] = useState<DefinitionSelection>();
	const query = useListGroupingClasses({
		path: { id: context.id },
		query: { limit: 25, cursor: cursors.at(-1) },
	});
	const assign = useAssignGroupingClass(),
		remove = useRemoveGroupingClass();
	const changed = () => {
		context.onChanged();
		void query.refetch();
		setSelected(undefined);
	};
	if (query.isPending) return <QueryPending />;
	if (query.isError) return <QueryFailure error={query.error} retry={() => void query.refetch()} />;
	return (
		<section className="grid gap-3">
			<h3 className="font-semibold">{t.units.nativeGrouping.classes}</h3>
			<DefinitionLabelBatch ids={query.data.items.map((item) => item.classRevisionId)}>
				{query.data.items.map((item) => (
					<div key={item.classRevisionId} className="flex items-center gap-3">
						<ExactDefinitionName id={item.classRevisionId} />
						{context.canEdit ? (
							<Button
								variant="quiet"
								disabled={remove.isPending}
								onClick={() => {
									void remove
										.mutateAsync({
											path: { id: context.id, classRevisionId: item.classRevisionId },
											body: { expectedRevision: context.revision },
										})
										.then(changed)
										.catch(() => undefined);
								}}
							>
								{t.units.nativeSemantics.remove}
							</Button>
						) : null}
					</div>
				))}
			</DefinitionLabelBatch>
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
					<DefinitionSelect
						kind="class"
						label={t.units.nativeGrouping.classes}
						value={selected}
						onChange={setSelected}
					/>
					<Button
						disabled={!selected || assign.isPending}
						onClick={() => {
							if (selected)
								void assign
									.mutateAsync({
										path: { id: context.id, classRevisionId: selected.revision.id },
										body: { expectedRevision: context.revision },
									})
									.then(changed)
									.catch(() => undefined);
						}}
					>
						{t.ui.save}
					</Button>
				</>
			) : null}
			<RequestFailure error={assign.error ?? remove.error} />
		</section>
	);
}
function GroupingHistory(context: GroupingEditContext) {
	const { t } = useTranslation(["units"]),
		[cursors, setCursors] = useState<string[]>([]);
	const query = useListGroupingHistory({
			path: { id: context.id },
			query: { limit: 25, cursor: cursors.at(-1) },
		}),
		restore = useRestoreGroupingCommand();
	if (query.isPending) return <QueryPending />;
	if (query.isError) return <QueryFailure error={query.error} retry={() => void query.refetch()} />;
	return (
		<section className="grid gap-3">
			{query.data.items.map((item) => (
				<article key={item.revision} className="grid gap-2 rounded border p-3">
					<p>
						{t.units.nativeGrouping.operations[item.snapshot.operation]} · {item.revision}
					</p>
					<time dateTime={item.createdAt}>{item.createdAt}</time>
					{"classRevisionId" in item.snapshot ? (
						<ExactDefinitionName id={item.snapshot.classRevisionId} />
					) : "key" in item.snapshot ? (
						<p>{item.snapshot.key}</p>
					) : (
						<code>{item.snapshot.relationId}</code>
					)}
					<Button
						disabled={restore.isPending}
						onClick={() => {
							void restore
								.mutateAsync({
									path: { id: context.id },
									body: { expectedRevision: context.revision, historicalRevision: item.revision },
								})
								.then(() => {
									context.onChanged();
									void query.refetch();
								})
								.catch(() => undefined);
						}}
					>
						{t.units.nativeGrouping.reapply}
					</Button>
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
			<RequestFailure error={restore.error} />
		</section>
	);
}
