"use client";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useApplicationRouter } from "@/features/application-shell/hooks/use-application-router";
import type { CatalogReference } from "@rezics/reference";
import {
	useReadCatalogResource,
	useListCatalogResourceSourceBindings,
	useReviseCatalogSourceBinding,
	useIntakeCatalogSource,
	useProposeCatalogSourceAdoption,
	listCatalogSourceProposalsQueryKey,
	type ListCatalogResourceSourceBindingsStatus200,
} from "@rezics/openapi-tanstack-query";
import { Badge, Button, PageHeading, QueryFailure, QueryPending } from "@rezics/ui";
import { AppLink } from "@/features/application-shell/components/app-link";
import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import { SourceChoice, SourceText } from "../components/source-fields";
import { SourceProposals } from "../components/source-proposals";
import { SourceJob } from "../components/source-job";
import { sourceIntakeBody, sourceProvider, sourceObjectType } from "../model/source-intake";
type Binding = ListCatalogResourceSourceBindingsStatus200["items"][number];
type Cursor = NonNullable<ListCatalogResourceSourceBindingsStatus200["after"]>;
export function CatalogSourcesPage({ reference }: { reference: CatalogReference }) {
	const { t } = useTranslation(["units", "actions", "ui"]),
		copy = t.units.nativeSources;
	const [cursors, setCursors] = useState<Cursor[]>([]);
	const resource = useReadCatalogResource({ path: reference }),
		query = useListCatalogResourceSourceBindings({
			path: reference,
			query: { limit: 25, ...cursors.at(-1) },
		});
	if (resource.isPending || query.isPending) return <QueryPending />;
	if (resource.isError)
		return <QueryFailure error={resource.error} retry={() => void resource.refetch()} />;
	if (query.isError) return <QueryFailure error={query.error} retry={() => void query.refetch()} />;
	return (
		<main className="mx-auto grid max-w-4xl gap-6 px-4 py-8">
			<PageHeading title={copy.title} />
			<Button asChild variant="outline">
				<AppLink href={`/catalog/${reference.owner}/${reference.id}`}>{copy.openRecord}</AppLink>
			</Button>
			{query.data.items.length ? (
				query.data.items.map((binding) => (
					<SourceBinding
						key={`${binding.mappingKey}:${binding.sourceRecordId}:${binding.bindingRevision}`}
						binding={binding}
						canEdit={resource.data.canEdit}
						onChanged={() => void query.refetch()}
					/>
				))
			) : (
				<p>{copy.noBindings}</p>
			)}
			<div className="flex gap-2">
				{cursors.length ? (
					<Button variant="outline" onClick={() => setCursors((value) => value.slice(0, -1))}>
						{t.ui.shelf.previous}
					</Button>
				) : null}
				{query.data.after ? (
					<Button
						variant="outline"
						onClick={() => {
							const after = query.data.after;
							if (after) setCursors((value) => [...value, after]);
						}}
					>
						{t.actions.loadMore}
					</Button>
				) : null}
			</div>
		</main>
	);
}
function SourceBinding({
	binding,
	canEdit,
	onChanged,
}: {
	binding: Binding;
	canEdit: boolean;
	onChanged: () => void;
}) {
	const { t } = useTranslation(["units"]),
		copy = t.units.nativeSources;
	const [editing, setEditing] = useState(false),
		[history, setHistory] = useState(false),
		[state, setState] = useState(binding.state),
		[mode, setMode] = useState(binding.mode),
		[reason, setReason] = useState(""),
		[job, setJob] = useState<{ sourceRecordId: string; id: string } | null>(null);
	const router = useApplicationRouter(),
		cache = useQueryClient();
	const revise = useReviseCatalogSourceBinding(),
		refresh = useIntakeCatalogSource(),
		propose = useProposeCatalogSourceAdoption();
	const provider = sourceProvider(binding.source),
		type = sourceObjectType(binding.objectType),
		body = provider ? sourceIntakeBody(provider, binding.objectType, binding.externalId) : null;
	const path = { sourceRecordId: binding.sourceRecordId, mappingKey: binding.mappingKey };
	function refreshHistory() {
		void cache.invalidateQueries({ queryKey: listCatalogSourceProposalsQueryKey({ path }) });
	}
	const busy = revise.isPending || refresh.isPending || propose.isPending;
	return (
		<section className="grid gap-4 rounded-xl border p-5">
			<h2 className="font-semibold">
				{provider ? copy.providers[provider] : binding.source} ·{" "}
				{type ? copy.objectTypes[type] : binding.objectType}
			</h2>
			<p className="break-all">{binding.externalId}</p>
			<div className="flex flex-wrap gap-2">
				<Badge>{copy.bindingStates[binding.state]}</Badge>
				<Badge variant="outline">{copy.modes[binding.mode]}</Badge>
			</div>
			<div className="flex flex-wrap gap-2">
				<Button
					variant="outline"
					aria-expanded={history}
					onClick={() => setHistory((value) => !value)}
				>
					{copy.history}
				</Button>
				{canEdit ? (
					<>
						<Button
							variant="outline"
							aria-expanded={editing}
							onClick={() => setEditing((value) => !value)}
						>
							{copy.bindingSettings}
						</Button>
						{body ? (
							<Button
								variant="outline"
								disabled={busy}
								onClick={() => {
									void refresh
										.mutateAsync({ body, query: { refresh: "true" } })
										.then((result) => {
											if (result.status === "queued") {
												setJob(result.job);
												router.push(
													`/catalog/sources/${result.job.sourceRecordId}/jobs/${result.job.id}`,
												);
											}
											onChanged();
											refreshHistory();
										})
										.catch(() => undefined);
								}}
							>
								{copy.checkSource}
							</Button>
						) : null}
						{binding.headSnapshotId &&
						binding.observedSnapshotId !== binding.headSnapshotId &&
						binding.state === "active" ? (
							<Button
								disabled={busy}
								onClick={() => {
									const snapshotId = binding.headSnapshotId;
									if (!snapshotId) return;
									void propose
										.mutateAsync({
											path,
											body: { snapshotId, mappingVersion: binding.mappingVersion },
										})
										.then(() => {
											setHistory(true);
											refreshHistory();
											onChanged();
										})
										.catch(() => undefined);
								}}
							>
								{copy.propose}
							</Button>
						) : null}
					</>
				) : null}
			</div>
			{editing && canEdit ? (
				<form
					className="grid gap-3"
					onSubmit={(event) => {
						event.preventDefault();
						if (busy || !reason.trim() || reason.trim().length > 2048) return;
						void revise
							.mutateAsync({
								path,
								body: {
									expectedRevision: binding.bindingRevision,
									state,
									mode,
									reason: reason.trim(),
								},
							})
							.then(() => {
								setEditing(false);
								onChanged();
							})
							.catch(() => undefined);
					}}
				>
					<SourceChoice
						label={copy.bindingState}
						value={state}
						values={["active", "paused", "withdrawn"]}
						labelFor={(value) => copy.bindingStates[value]}
						onChange={setState}
					/>
					<SourceChoice
						label={copy.mode}
						value={mode}
						values={["review", "manual"]}
						labelFor={(value) => copy.modes[value]}
						onChange={setMode}
					/>
					<SourceText label={copy.reason} value={reason} onChange={setReason} multiline required />
					{state === "withdrawn" ? <p>{copy.withdrawBindingNotice}</p> : null}
					<Button disabled={busy || !reason.trim() || reason.trim().length > 2048} type="submit">
						{copy.save}
					</Button>
				</form>
			) : null}
			{revise.error ? <RequestFailure error={revise.error} /> : null}
			{refresh.error ? <RequestFailure error={refresh.error} /> : null}
			{propose.error ? <RequestFailure error={propose.error} /> : null}
			{refresh.data && refresh.data.status !== "queued" ? (
				<p role="status">{copy.intakeStates[refresh.data.status]}</p>
			) : null}
			{propose.data ? <p role="status">{copy.proposeStates[propose.data.status]}</p> : null}
			{job ? <SourceJob sourceRecordId={job.sourceRecordId} jobId={job.id} /> : null}
			{history ? (
				<SourceProposals
					sourceRecordId={binding.sourceRecordId}
					mappingKey={binding.mappingKey}
					canEdit={canEdit}
					onChanged={onChanged}
				/>
			) : null}
		</section>
	);
}
