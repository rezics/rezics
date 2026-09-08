"use client";
import { useState } from "react";
import {
	useReadCatalogEntityProfile,
	useReadCatalogResource,
	useWriteCatalogEntityProfile,
	useRemoveCatalogEntityProfile,
	useResolveCatalogEntityShape,
	useListCatalogEntityProfileHistory,
	useRestoreCatalogEntityProfile,
	type ReadCatalogEntityProfileStatus200,
	type ResolveCatalogEntityShapeBody,
} from "@rezics/openapi-tanstack-query";
import { Button, QueryFailure, QueryPending } from "@rezics/ui";
import {
	DefinitionText,
	DefinitionChoice,
	DefinitionNumber,
} from "@/features/catalog-definitions/components/definition-fields";
import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
type Profile = ReadCatalogEntityProfileStatus200["profile"];
type DateValue = Profile["begin"];
const referenceFields = [
	"typeRevisionId",
	"genderRevisionId",
	"areaId",
	"beginAreaId",
	"endAreaId",
] as const;
const shapes: readonly ResolveCatalogEntityShapeBody["shape"][] = [
	"person",
	"organization",
	"character",
	"label",
	"collective",
	"service_actor",
];
export function EntityProfile({ id }: { id: string }) {
	const { t } = useTranslation(["entities"]);
	const resource = useReadCatalogResource({ path: { owner: "entity", id } });
	const query = useReadCatalogEntityProfile({ path: { id } });
	if (query.isPending) return <QueryPending />;
	if (query.isError) return <QueryFailure error={query.error} retry={() => void query.refetch()} />;
	return (
		<section className="grid gap-4 rounded border p-4">
			<h2 className="font-semibold">{t.entities.fixedProfile.title}</h2>
			<ProfileValues value={query.data.profile} />
			{resource.data?.canEdit ? (
				<ProfileEditor
					key={`${id}:${query.data.revision}`}
					value={query.data}
					onChanged={() => {
						void query.refetch();
						void resource.refetch();
					}}
				/>
			) : null}
		</section>
	);
}
function ProfileValues({ value }: { value: Profile }) {
	const { t } = useTranslation(["entities", "units", "create"]),
		copy = t.entities.fixedProfile;
	const dateText = (value: DateValue) =>
		value
			? [
					value.year ?? t.units.nativeDomain.unknown,
					value.month ?? t.units.nativeDomain.unknown,
					value.day ?? t.units.nativeDomain.unknown,
				].join(" / ") + (value.text ? ` (${value.text})` : "")
			: t.units.nativeDomain.unknown;
	return (
		<dl className="grid gap-2">
			{referenceFields.map((field) =>
				value[field] ? (
					<div key={field}>
						<dt>{copy[field]}</dt>
						<dd className="break-all">{value[field]}</dd>
					</div>
				) : null,
			)}
			<div>
				<dt>{copy.begin}</dt>
				<dd>{dateText(value.begin)}</dd>
			</div>
			<div>
				<dt>{copy.end}</dt>
				<dd>{dateText(value.end)}</dd>
			</div>
			<div>
				<dt>{copy.ended}</dt>
				<dd>
					{value.ended === null
						? t.create.native.truth.unknown
						: value.ended
							? t.create.native.truth.yes
							: t.create.native.truth.no}
				</dd>
			</div>
		</dl>
	);
}
function ProfileDate({
	label,
	value,
	onChange,
}: {
	label: string;
	value: DateValue;
	onChange: (value: DateValue) => void;
}) {
	const { t } = useTranslation(["create"]);
	const update = (patch: Partial<NonNullable<DateValue>>) => {
		const next = { year: null, month: null, day: null, text: null, ...value, ...patch };
		onChange(
			next.year === null && next.month === null && next.day === null && next.text === null
				? null
				: next,
		);
	};
	return (
		<fieldset className="grid gap-2">
			<legend>{label}</legend>
			<DefinitionNumber
				label={t.create.native.fields.year}
				value={value?.year ?? undefined}
				onChange={(year) => update({ year: year ?? null })}
				integer
				min={-2147483648}
				max={2147483647}
			/>
			<DefinitionNumber
				label={t.create.native.fields.month}
				value={value?.month ?? undefined}
				onChange={(month) => update({ month: month ?? null })}
				integer
				min={1}
				max={12}
			/>
			<DefinitionNumber
				label={t.create.native.fields.day}
				value={value?.day ?? undefined}
				onChange={(day) => update({ day: day ?? null })}
				integer
				min={1}
				max={31}
			/>
			<DefinitionText
				label={t.create.native.fields.dateText}
				value={value?.text ?? ""}
				onChange={(text) => update({ text: text || null })}
			/>
		</fieldset>
	);
}
function ProfileEditor({
	value,
	onChanged,
}: {
	value: ReadCatalogEntityProfileStatus200;
	onChanged: () => void;
}) {
	const { t } = useTranslation(["entities", "ui", "units", "create"]),
		copy = t.entities.fixedProfile;
	const [editing, setEditing] = useState(false),
		[draft, setDraft] = useState(value.profile),
		[history, setHistory] = useState(false),
		[shape, setShape] = useState<ResolveCatalogEntityShapeBody["shape"]>("person");
	const write = useWriteCatalogEntityProfile(),
		remove = useRemoveCatalogEntityProfile(),
		resolve = useResolveCatalogEntityShape();
	const pending = write.isPending || remove.isPending || resolve.isPending;
	return (
		<div className="grid gap-3">
			<Button
				variant="outline"
				aria-expanded={editing}
				onClick={() => setEditing((current) => !current)}
			>
				{t.ui.edit}
			</Button>
			{editing ? (
				<fieldset disabled={pending} inert={pending} className="grid gap-3">
					<p>{copy.referenceNotice}</p>
					{referenceFields
						.filter(
							(field) =>
								field !== "genderRevisionId" ||
								["person", "character", "unresolved"].includes(value.shape),
						)
						.map((field) => (
							<DefinitionText
								key={field}
								label={copy[field]}
								value={draft[field] ?? ""}
								onChange={(next) =>
									setDraft((current) => ({ ...current, [field]: next.trim() || null }))
								}
							/>
						))}
					<ProfileDate
						label={copy.begin}
						value={draft.begin}
						onChange={(begin) => setDraft((current) => ({ ...current, begin }))}
					/>
					<ProfileDate
						label={copy.end}
						value={draft.end}
						onChange={(end) => setDraft((current) => ({ ...current, end }))}
					/>
					<DefinitionChoice
						label={copy.ended}
						value={draft.ended === null ? "unknown" : draft.ended ? "yes" : "no"}
						values={["unknown", "yes", "no"]}
						labelFor={(key) => t.create.native.truth[key]}
						onChange={(next) =>
							setDraft((current) => ({
								...current,
								ended: next === "unknown" ? null : next === "yes",
							}))
						}
					/>
					<Button
						onClick={() =>
							void write
								.mutateAsync({
									path: { id: value.id },
									body: { expectedRevision: value.revision, profile: draft },
								})
								.then(onChanged)
								.catch(() => undefined)
						}
					>
						{t.ui.save}
					</Button>
					<Button
						variant="outline"
						onClick={() =>
							void remove
								.mutateAsync({ path: { id: value.id }, body: { expectedRevision: value.revision } })
								.then(onChanged)
								.catch(() => undefined)
						}
					>
						{copy.remove}
					</Button>
					{value.shape === "unresolved" ? (
						<>
							<p>{copy.resolveNotice}</p>
							<DefinitionChoice
								label={t.create.native.shape}
								value={shape}
								values={shapes}
								labelFor={(key) => t.create.native.entityShapes[key]}
								onChange={setShape}
							/>
							<Button
								onClick={() =>
									void resolve
										.mutateAsync({
											path: { id: value.id },
											body: { expectedRevision: value.revision, shape },
										})
										.then(onChanged)
										.catch(() => undefined)
								}
							>
								{copy.resolve}
							</Button>
						</>
					) : null}
				</fieldset>
			) : null}
			<RequestFailure error={write.error ?? remove.error ?? resolve.error} />
			<Button
				variant="quiet"
				aria-expanded={history}
				onClick={() => setHistory((current) => !current)}
			>
				{t.units.nativeDomain.history}
			</Button>
			{history ? (
				<ProfileHistory id={value.id} revision={value.revision} onChanged={onChanged} />
			) : null}
		</div>
	);
}
function ProfileHistory({
	id,
	revision,
	onChanged,
}: {
	id: string;
	revision: number;
	onChanged: () => void;
}) {
	const { t } = useTranslation(["entities", "ui", "units"]),
		[cursors, setCursors] = useState<string[]>([]);
	const query = useListCatalogEntityProfileHistory({
			path: { id },
			query: { cursor: cursors.at(-1), limit: 25 },
		}),
		restore = useRestoreCatalogEntityProfile();
	if (query.isPending) return <QueryPending />;
	if (query.isError) return <QueryFailure error={query.error} retry={() => void query.refetch()} />;
	return (
		<div className="grid gap-3">
			{query.data.items.map((item) => (
				<article key={item.revision} className="grid gap-2 rounded border p-3">
					<p>
						{item.revision} · <time dateTime={item.createdAt}>{item.createdAt}</time>
					</p>
					{item.profile ? (
						<ProfileValues value={item.profile} />
					) : (
						<p>{t.entities.fixedProfile.removed}</p>
					)}
					<Button
						disabled={restore.isPending}
						onClick={() =>
							void restore
								.mutateAsync({
									path: { id },
									body: { expectedRevision: revision, historicalRevision: item.revision },
								})
								.then(() => {
									onChanged();
									void query.refetch();
								})
								.catch(() => undefined)
						}
					>
						{t.units.nativeDomain.restore}
					</Button>
				</article>
			))}
			<RequestFailure error={restore.error} />
			<div className="flex gap-2">
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
						{t.ui.shelf.next}
					</Button>
				) : null}
			</div>
		</div>
	);
}
