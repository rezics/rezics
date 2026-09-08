"use client";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
	useReadPublishingDetails,
	useRevisePublishingDetails,
	useListCatalogNames,
	useReviseCatalogName,
	useAddCatalogName,
	readPublishingDetailsQueryKey,
	listCatalogNamesQueryKey,
	readCatalogResourceQueryKey,
	type ReadPublishingDetailsStatus200,
	type ListCatalogNamesStatus200,
} from "@rezics/openapi-tanstack-query";
import { Button, Field, FieldLabel, Input, QueryPending, QueryFailure } from "@rezics/ui";
import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import { AppLink } from "@/features/application-shell/components/app-link";
import { DomainField, optionalNumber, optionalText } from "./domain-field";
import { PublishingRelatedContent } from "./publishing-related-content";
import { PublishingHistory } from "./publishing-component-history";

type Details = ReadPublishingDetailsStatus200;
type Structure = Details["structure"];
const componentFor = (shape: Structure["shape"]) =>
	(
		({
			work: "publishing_work",
			text_version: "publishing_text_version",
			publication: "publishing_publication",
			serialization: "publishing_serialization",
		}) as const
	)[shape];
export function PublishingResourceDetails({ id }: { id: string }) {
	const query = useReadPublishingDetails({ path: { id } });
	if (query.isPending) return <QueryPending />;
	if (query.isError) return <QueryFailure error={query.error} retry={() => void query.refetch()} />;
	return (
		<>
			<PublishingTitleEditor data={query.data} />
			{query.data.structure.shape === "publication" ||
			query.data.structure.shape === "text_version" ? (
				<PublishingFixedEditor key={query.data.historyId} data={query.data} />
			) : null}
			<PublishingRelatedContent data={query.data} />
		</>
	);
}
function PublishingTitleEditor({ data }: { data: Details }) {
	const { t } = useTranslation(["units", "ui"]);
	const [open, setOpen] = useState(false);
	const query = useListCatalogNames({
		path: { owner: "publishing", id: data.id },
		query: { limit: 50, maxSpoiler: 0 },
	});
	if (!data.canEdit) return null;
	if (query.isPending) return <QueryPending />;
	if (query.isError) return <QueryFailure error={query.error} retry={() => void query.refetch()} />;
	const name = query.data.items.find((item) => item.scopeOwnerId === null);
	return (
		<section className="grid gap-3">
			<div className="flex gap-2">
				<Button variant="outline" onClick={() => setOpen(!open)} aria-expanded={open}>
					{t.units.nativePublishing.editTitle}
				</Button>
				{data.structure.shape === "text_version" ? (
					<AppLink
						className="inline-flex items-center rounded-lg border px-3 py-1.5 text-sm font-medium"
						href={`/catalog/publishing/${data.id}/contents/edit`}
					>
						{t.units.workspace.sections.contentStructure.label}
					</AppLink>
				) : null}
			</div>
			{open ? (
				<TitleForm
					key={`${name?.id ?? data.id}:${name?.revision ?? data.revision}`}
					data={data}
					name={name}
					close={() => setOpen(false)}
				/>
			) : null}
		</section>
	);
}
function TitleForm({
	data,
	name,
	close,
}: {
	data: Details;
	name: ListCatalogNamesStatus200["items"][number] | undefined;
	close: () => void;
}) {
	const { t } = useTranslation(["units", "ui"]),
		client = useQueryClient();
	const [text, setText] = useState(name?.value ?? "");
	const saved = async () => {
		await Promise.all([
			client.invalidateQueries({
				queryKey: listCatalogNamesQueryKey({ path: { owner: "publishing", id: data.id } }),
			}),
			client.invalidateQueries({
				queryKey: readPublishingDetailsQueryKey({ path: { id: data.id } }),
			}),
			client.invalidateQueries({
				queryKey: readCatalogResourceQueryKey({ path: { owner: "publishing", id: data.id } }),
			}),
		]);
		close();
	};
	const revise = useReviseCatalogName({ mutation: { onSuccess: saved } }),
		create = useAddCatalogName({ mutation: { onSuccess: saved } }),
		pending = revise.isPending || create.isPending;
	return (
		<form
			className="grid gap-3"
			onSubmit={(event) => {
				event.preventDefault();
				if (name) {
					const {
						ownerId: _owner,
						id: _id,
						revision: _revision,
						createdAt: _created,
						recordedAt: _recorded,
						...value
					} = name;
					revise.mutate({
						path: { owner: "publishing", id: data.id, nameId: name.id },
						body: { expectedRevision: name.revision, value: { ...value, value: text } },
					});
				} else
					create.mutate({
						path: { owner: "publishing", id: data.id },
						body: {
							expectedRevision: data.revision,
							value: {
								value: text,
								kind: "primary",
								languageTag: null,
								sortName: null,
								privateUseNamespace: null,
								origin: "unknown",
								translationMethod: "unknown",
								primaryForLanguage: null,
								scopeOwnerId: null,
								territory: null,
								context: null,
								derivationNameId: null,
								derivationRevision: null,
								begin: null,
								end: null,
								ended: null,
								spoiler: 0,
								state: "active",
							},
						},
					});
			}}
		>
			<Field>
				<FieldLabel>{t.ui.title}</FieldLabel>
				<Input
					value={text}
					onChange={(event) => setText(event.target.value)}
					required
					disabled={pending}
				/>
			</Field>
			<RequestFailure error={revise.error ?? create.error} />
			<div className="flex gap-2">
				<Button type="submit" disabled={pending}>
					{t.ui.save}
				</Button>
				<Button type="button" variant="outline" onClick={close} disabled={pending}>
					{t.units.nativeDomain.cancel}
				</Button>
			</div>
		</form>
	);
}
function PublishingFixedEditor({ data }: { data: Details }) {
	const { t } = useTranslation(["units", "ui"]),
		client = useQueryClient();
	const [draft, setDraft] = useState(data.structure),
		[editing, setEditing] = useState(false),
		[history, setHistory] = useState(false);
	const mutation = useRevisePublishingDetails({
		mutation: {
			onSuccess: async () => {
				await Promise.all([
					client.invalidateQueries({
						queryKey: readPublishingDetailsQueryKey({ path: { id: data.id } }),
					}),
					client.invalidateQueries({
						queryKey: readCatalogResourceQueryKey({ path: { owner: "publishing", id: data.id } }),
					}),
				]);
				setEditing(false);
			},
		},
	});
	return (
		<section className="grid gap-4">
			<h2 className="text-lg font-semibold">{t.units.nativePublishing[data.structure.shape]}</h2>
			<form
				className="grid gap-3"
				onSubmit={(event) => {
					event.preventDefault();
					mutation.mutate({
						path: { id: data.id },
						body: {
							expectedRevision: data.revision,
							expectedHistoryId: data.historyId,
							structure: draft,
						},
					});
				}}
			>
				<fieldset className="grid gap-3 sm:grid-cols-2" disabled={!editing || mutation.isPending}>
					{draft.shape === "publication" ? (
						<>
							<DomainField
								label={t.units.nativePublishing.pageCount}
								value={draft.fields.pageCount}
								numeric
								onChange={(value) =>
									setDraft({
										...draft,
										fields: { ...draft.fields, pageCount: optionalNumber(value) },
									})
								}
							/>
							<DomainField
								label={t.units.nativePublishing.pagination}
								value={draft.fields.paginationText}
								onChange={(value) =>
									setDraft({
										...draft,
										fields: { ...draft.fields, paginationText: optionalText(value) },
									})
								}
							/>
						</>
					) : draft.shape === "text_version" ? (
						<DomainField
							label={t.units.nativeDomain.language}
							value={draft.fields.languageTag}
							onChange={(value) =>
								setDraft({
									...draft,
									fields: { ...draft.fields, languageTag: optionalText(value) },
								})
							}
						/>
					) : null}
				</fieldset>
				<RequestFailure error={mutation.error} />
				{data.canEdit ? (
					<div className="flex gap-2">
						{editing ? (
							<>
								<Button type="submit" disabled={mutation.isPending}>
									{t.ui.save}
								</Button>
								<Button
									type="button"
									variant="outline"
									disabled={mutation.isPending}
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
				<PublishingHistory
					data={data}
					component={componentFor(data.structure.shape)}
					componentKey={data.id}
					currentHistoryId={data.historyId}
				/>
			) : null}
		</section>
	);
}
