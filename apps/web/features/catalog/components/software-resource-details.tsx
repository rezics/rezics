"use client";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
	useReadSoftwareDetails,
	useReviseSoftwareDetails,
	useListSoftwareDetailsHistory,
	useRestoreSoftwareDetails,
	readSoftwareDetailsQueryKey,
	listSoftwareDetailsHistoryQueryKey,
	readCatalogResourceQueryKey,
	type ReadSoftwareDetailsStatus200,
} from "@rezics/openapi-tanstack-query";
import { Button, QueryPending, QueryFailure, NativeSelect, Field, FieldLabel } from "@rezics/ui";
import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import { DomainField, optionalText, optionalNumber } from "./domain-field";

import { SoftwareReleaseList } from "./native-related-lists";

type Details = ReadSoftwareDetailsStatus200["details"];
export function SoftwareResourceDetails({ id }: { id: string }) {
	const query = useReadSoftwareDetails({ path: { id } });
	if (query.isPending) return <QueryPending />;
	if (query.isError) return <QueryFailure error={query.error} retry={() => void query.refetch()} />;
	return (
		<>
			<SoftwareEditor key={`${id}:${query.data.revision}`} data={query.data} />
			{query.data.details.kind !== "release" ? <SoftwareReleaseList key={id} id={id} /> : null}
		</>
	);
}
function SoftwareEditor({ data }: { data: ReadSoftwareDetailsStatus200 }) {
	const { t } = useTranslation(["units", "ui"]);
	const [draft, setDraft] = useState<Details>(data.details);
	const [editing, setEditing] = useState(false);
	const [history, setHistory] = useState(false);
	const client = useQueryClient();
	const refresh = async () => {
		await Promise.all([
			client.invalidateQueries({
				queryKey: readSoftwareDetailsQueryKey({ path: { id: data.id } }),
			}),
			client.invalidateQueries({
				queryKey: listSoftwareDetailsHistoryQueryKey({ path: { id: data.id } }),
			}),
			client.invalidateQueries({
				queryKey: readCatalogResourceQueryKey({ path: { owner: "software", id: data.id } }),
			}),
		]);
		setEditing(false);
	};
	const save = useReviseSoftwareDetails({ mutation: { onSuccess: refresh } });
	const restore = useRestoreSoftwareDetails({ mutation: { onSuccess: refresh } });
	const disabled = !editing || save.isPending;
	return (
		<section className="grid gap-4">
			<h2 className="text-lg font-semibold">{t.units.nativeDomain.details}</h2>
			<form
				className="grid gap-4"
				onSubmit={(event) => {
					event.preventDefault();
					save.mutate({
						path: { id: data.id },
						body: { expectedRevision: data.revision, details: draft },
					});
				}}
			>
				<fieldset disabled={disabled} className="grid gap-4 sm:grid-cols-2">
					{draft.kind === "content" ? (
						<>
							<DomainField
								label={t.units.nativeDomain.language}
								value={draft.value.originalLanguageTag}
								onChange={(value) =>
									setDraft({
										...draft,
										value: { ...draft.value, originalLanguageTag: optionalText(value) },
									})
								}
							/>
							<Field>
								<FieldLabel>{t.units.nativeDomain.development}</FieldLabel>
								<NativeSelect
									value={draft.value.developmentStatus ?? ""}
									onChange={(event) => {
										const value = event.target.value;
										if (
											value === "" ||
											value === "finished" ||
											value === "in_development" ||
											value === "cancelled"
										)
											setDraft({
												...draft,
												value: { ...draft.value, developmentStatus: value || null },
											});
									}}
								>
									<option value="">{t.units.nativeDomain.unknown}</option>
									<option value="in_development">{t.units.nativeDomain.inDevelopment}</option>
									<option value="finished">{t.units.nativeDomain.finished}</option>
									<option value="cancelled">{t.units.nativeDomain.cancelled}</option>
								</NativeSelect>
							</Field>
							<DomainField
								label={t.ui.description}
								value={draft.value.description}
								multiline
								onChange={(value) =>
									setDraft({
										...draft,
										value: { ...draft.value, description: optionalText(value) },
									})
								}
							/>
						</>
					) : draft.kind === "version" ? (
						<>
							<DomainField
								label={t.ui.title}
								value={draft.value.versionLabel}
								onChange={(value) =>
									setDraft({
										...draft,
										value: { ...draft.value, versionLabel: optionalText(value) },
									})
								}
							/>
							<DomainField
								label={t.units.nativeDomain.language}
								value={draft.value.languageTag}
								onChange={(value) =>
									setDraft({
										...draft,
										value: { ...draft.value, languageTag: optionalText(value) },
									})
								}
							/>
							<DomainField
								label={t.units.nativeDomain.evidence}
								value={draft.value.distinguishingEvidence}
								multiline
								onChange={(value) =>
									setDraft({ ...draft, value: { ...draft.value, distinguishingEvidence: value } })
								}
							/>
						</>
					) : (
						<>
							<DomainField
								label={t.units.nativeDomain.notes}
								value={draft.value.notes}
								multiline
								onChange={(value) =>
									setDraft({ ...draft, value: { ...draft.value, notes: optionalText(value) } })
								}
							/>
							<DomainField
								label={t.units.nativeDomain.minimumAge}
								value={draft.value.minimumAge}
								numeric
								onChange={(value) =>
									setDraft({
										...draft,
										value: { ...draft.value, minimumAge: optionalNumber(value) },
									})
								}
							/>
							<DomainField
								label={t.units.nativeDomain.productCode}
								value={draft.value.catalogNumber}
								onChange={(value) =>
									setDraft({
										...draft,
										value: { ...draft.value, catalogNumber: optionalText(value) },
									})
								}
							/>
							{(["year", "month", "day"] as const).map((field) => (
								<DomainField
									key={field}
									label={t.units.nativeDomain[field]}
									value={draft.value.date[field]}
									numeric
									onChange={(value) =>
										setDraft({
											...draft,
											value: {
												...draft.value,
												date: { ...draft.value.date, [field]: optionalNumber(value) },
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
										setDraft(data.details);
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
							onClick={() => setHistory(!history)}
							aria-expanded={history}
						>
							{t.units.nativeDomain.history}
						</Button>
					</div>
				) : null}
			</form>
			{history ? (
				<SoftwareHistory
					data={data}
					restoring={restore.isPending}
					restore={(revision) =>
						restore.mutate({
							path: { id: data.id },
							body: { expectedRevision: data.revision, historicalRevision: revision },
						})
					}
				/>
			) : null}
			<RequestFailure error={restore.error} />
		</section>
	);
}
function SoftwareHistory({
	data,
	restoring,
	restore,
}: {
	data: ReadSoftwareDetailsStatus200;
	restoring: boolean;
	restore: (revision: number) => void;
}) {
	const { t, locale } = useTranslation(["units", "actions", "ui"]);
	const [cursors, setCursors] = useState<string[]>([]);
	const query = useListSoftwareDetailsHistory({
		path: { id: data.id },
		query: { limit: 20, cursor: cursors.at(-1) },
	});
	if (query.isPending) return <QueryPending />;
	if (query.isError) return <QueryFailure error={query.error} retry={() => void query.refetch()} />;
	return (
		<div className="grid gap-3">
			<ol className="grid gap-2">
				{query.data.items.map((item) => (
					<li key={item.revision} className="grid gap-2">
						<details>
							<summary className="cursor-pointer">
								<time dateTime={item.recordedAt}>
									{new Date(item.recordedAt).toLocaleString(locale.target)}
								</time>
							</summary>
							<SoftwareEditor
								data={{ ...data, revision: item.revision, details: item.details, canEdit: false }}
							/>
						</details>
						<Button
							variant="outline"
							disabled={restoring || item.revision === data.revision}
							onClick={() => restore(item.revision)}
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
