"use client";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
	useReadProgramDetails,
	useReviseProgramDetails,
	useListProgramComponentHistory,
	useRestoreProgramComponent,
	readProgramDetailsQueryKey,
	listProgramComponentHistoryQueryKey,
	readCatalogResourceQueryKey,
	type ReadProgramDetailsStatus200,
} from "@rezics/openapi-tanstack-query";
import { Button, QueryPending, QueryFailure } from "@rezics/ui";
import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import { DomainField, optionalText, optionalNumber } from "./domain-field";

import { ProgramEpisodeList } from "./native-related-lists";

type Structure = ReadProgramDetailsStatus200["structure"];
const componentFor = (shape: Structure["shape"]) =>
	(
		({
			program: "program_work",
			season: "program_season",
			program_version: "program_version",
			episode: "program_episode",
		}) as const
	)[shape];
export function ProgramResourceDetails({ id }: { id: string }) {
	const query = useReadProgramDetails({ path: { id } });
	if (query.isPending) return <QueryPending />;
	if (query.isError) return <QueryFailure error={query.error} retry={() => void query.refetch()} />;
	return (
		<>
			<ProgramEditor
				key={`${id}:${query.data.revision}:${query.data.historyId}`}
				data={query.data}
			/>
			{query.data.structure.shape !== "episode" ? <ProgramEpisodeList key={id} id={id} /> : null}
		</>
	);
}
function ProgramEditor({ data }: { data: ReadProgramDetailsStatus200 }) {
	const { t } = useTranslation(["units", "ui"]);
	const [draft, setDraft] = useState<Structure>(data.structure);
	const [editing, setEditing] = useState(false);
	const [history, setHistory] = useState(false);
	const client = useQueryClient();
	const historyPath = {
		id: data.id,
		component: componentFor(data.structure.shape),
		componentKey: data.id,
	};
	const refresh = async () => {
		await Promise.all([
			client.invalidateQueries({ queryKey: readProgramDetailsQueryKey({ path: { id: data.id } }) }),
			client.invalidateQueries({
				queryKey: listProgramComponentHistoryQueryKey({ path: historyPath }),
			}),
			client.invalidateQueries({
				queryKey: readCatalogResourceQueryKey({ path: { owner: "program", id: data.id } }),
			}),
		]);
		setEditing(false);
	};
	const save = useReviseProgramDetails({ mutation: { onSuccess: refresh } });
	const restore = useRestoreProgramComponent({ mutation: { onSuccess: refresh } });
	return (
		<section className="grid gap-4">
			<h2 className="text-lg font-semibold">{t.units.nativeDomain.details}</h2>
			<form
				className="grid gap-4"
				onSubmit={(event) => {
					event.preventDefault();
					save.mutate({
						path: { id: data.id },
						body: {
							expectedRevision: data.revision,
							expectedHistoryId: data.historyId,
							structure: draft,
						},
					});
				}}
			>
				<fieldset disabled={!editing || save.isPending} className="grid gap-4 sm:grid-cols-2">
					{draft.shape === "program" ? (
						<>
							<DomainField
								label={t.units.nativeDomain.mainEpisodes}
								value={draft.fields.declaredMainEpisodeCount}
								numeric
								onChange={(value) =>
									setDraft({
										...draft,
										fields: { ...draft.fields, declaredMainEpisodeCount: optionalNumber(value) },
									})
								}
							/>
							<DomainField
								label={t.units.nativeDomain.totalEpisodes}
								value={draft.fields.declaredTotalEpisodeCount}
								numeric
								onChange={(value) =>
									setDraft({
										...draft,
										fields: { ...draft.fields, declaredTotalEpisodeCount: optionalNumber(value) },
									})
								}
							/>
						</>
					) : draft.shape === "season" ? (
						<DomainField
							label={t.units.nativeDomain.number}
							value={draft.fields.number}
							onChange={(value) =>
								setDraft({ ...draft, fields: { ...draft.fields, number: optionalText(value) } })
							}
						/>
					) : draft.shape === "program_version" ? (
						<DomainField
							label={t.units.nativeDomain.duration}
							value={draft.fields.lengthMilliseconds}
							numeric
							onChange={(value) =>
								setDraft({
									...draft,
									fields: { ...draft.fields, lengthMilliseconds: optionalNumber(value) },
								})
							}
						/>
					) : (
						<>
							<DomainField
								label={t.units.nativeDomain.episodeNumber}
								value={draft.fields.episodeNumber}
								numeric
								onChange={(value) =>
									setDraft({
										...draft,
										fields: { ...draft.fields, episodeNumber: optionalNumber(value) },
									})
								}
							/>
							<DomainField
								label={t.units.nativeDomain.orderNumber}
								value={draft.fields.sortNumber}
								numeric
								onChange={(value) =>
									setDraft({
										...draft,
										fields: { ...draft.fields, sortNumber: optionalNumber(value) },
									})
								}
							/>
							<DomainField
								label={t.units.nativeDomain.duration}
								value={draft.fields.lengthMilliseconds}
								numeric
								onChange={(value) =>
									setDraft({
										...draft,
										fields: { ...draft.fields, lengthMilliseconds: optionalNumber(value) },
									})
								}
							/>
							{(["year", "month", "day"] as const).map((field) => (
								<DomainField
									key={field}
									label={t.units.nativeDomain[field]}
									value={draft.fields.date[field]}
									numeric
									onChange={(value) =>
										setDraft({
											...draft,
											fields: {
												...draft.fields,
												date: { ...draft.fields.date, [field]: optionalNumber(value) },
											},
										})
									}
								/>
							))}
						</>
					)}
				</fieldset>
				<RequestFailure error={save.error} />
				{data.canEdit ? (
					<div className="flex gap-2">
						{editing ? (
							<>
								<Button type="submit" disabled={save.isPending}>
									{t.ui.save}
								</Button>
								<Button
									type="button"
									variant="outline"
									disabled={save.isPending}
									onClick={() => {
										setDraft(data.structure);
										setEditing(false);
									}}
								>
									{t.units.nativeDomain.cancel}
								</Button>
							</>
						) : (
							<Button type="button" variant="outline" onClick={() => setEditing(true)}>
								{t.ui.edit}
							</Button>
						)}
						<Button
							type="button"
							variant="outline"
							aria-expanded={history}
							onClick={() => setHistory(!history)}
						>
							{t.units.nativeDomain.history}
						</Button>
					</div>
				) : null}
			</form>
			{history ? (
				<ProgramHistory
					data={data}
					restoring={restore.isPending}
					restore={(historyId) =>
						restore.mutate({
							path: historyPath,
							body: {
								expectedRevision: data.revision,
								expectedHistoryId: data.historyId,
								historyId,
							},
						})
					}
				/>
			) : null}
			<RequestFailure error={restore.error} />
		</section>
	);
}
function ProgramHistory({
	data,
	restoring,
	restore,
}: {
	data: ReadProgramDetailsStatus200;
	restoring: boolean;
	restore: (historyId: string) => void;
}) {
	const { t, locale } = useTranslation(["units", "ui", "actions"]);
	const [cursors, setCursors] = useState<string[]>([]);
	const query = useListProgramComponentHistory({
		path: { id: data.id, component: componentFor(data.structure.shape), componentKey: data.id },
		query: { limit: 20, cursor: cursors.at(-1) },
	});
	if (query.isPending) return <QueryPending />;
	if (query.isError) return <QueryFailure error={query.error} retry={() => void query.refetch()} />;
	return (
		<div className="grid gap-3">
			<ol className="grid gap-2">
				{query.data.items.map((item) => (
					<li key={item.id} className="grid gap-2">
						<details>
							<summary className="cursor-pointer">
								<time dateTime={item.recordedAt}>
									{new Date(item.recordedAt).toLocaleString(locale.target)}
								</time>
							</summary>
							{item.snapshot.kind === "structure" ? (
								<ProgramEditor
									data={{
										...data,
										historyId: item.id,
										structure: item.snapshot.value,
										canEdit: false,
									}}
								/>
							) : null}
						</details>
						<Button
							variant="outline"
							disabled={restoring || item.id === data.historyId}
							onClick={() => restore(item.id)}
						>
							{t.units.nativeDomain.restore}
						</Button>
					</li>
				))}
			</ol>
			<div className="flex gap-2">
				{cursors.length ? (
					<Button variant="outline" onClick={() => setCursors(cursors.slice(0, -1))}>
						{t.ui.shelf.previous}
					</Button>
				) : null}
				{query.data.nextCursor ? (
					<Button
						variant="outline"
						onClick={() => {
							const cursor = query.data.nextCursor;
							if (cursor) setCursors([...cursors, cursor]);
						}}
					>
						{t.actions.loadMore}
					</Button>
				) : null}
			</div>
		</div>
	);
}
