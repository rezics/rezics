"use client";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { CatalogReferenceSchema } from "@rezics/reference";
import {
	useReadEntityMeasurementContext,
	useWriteEntityMeasurementContext,
} from "@rezics/openapi-tanstack-query";
import type {
	ReadEntityMeasurementContextStatus200,
	WriteEntityMeasurementContextBody,
} from "@rezics/openapi-tanstack-query";
import { Button, EntityPicker, Field, FieldLabel, QueryFailure, QueryPending } from "@rezics/ui";
import {
	DefinitionChoice,
	DefinitionText,
} from "@/features/catalog-definitions/components/definition-fields";
import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import {
	ContextMeasurementOwners,
	MeasurementFields,
	measurementDraft,
	parseMeasurementDraft,
} from "../model/context-measurements";
type Context = WriteEntityMeasurementContextBody["context"];
type ContextSelection = { reference: Context; label: string; shape?: string };

export function EntityContextMeasurements({
	entityId,
	onSaved,
}: {
	entityId: string;
	onSaved: () => void;
}) {
	const { t } = useTranslation(["units", "entities"]),
		copy = t.entities.contextMeasurements;
	const search = useSearchParams();
	const [context, setContext] = useState<ContextSelection | undefined>(() => {
		const reference = CatalogReferenceSchema.safeParse({
			owner: search.get("contextOwner"),
			id: search.get("contextId"),
		});
		const owner = reference.success
			? ContextMeasurementOwners.find((owner) => owner === reference.data.owner)
			: undefined;
		return reference.success && owner
			? { reference: { owner, id: reference.data.id }, label: reference.data.id }
			: undefined;
	});
	const [spoiler, setSpoiler] = useState<0 | 1 | 2>(0);
	return (
		<section className="grid gap-4 rounded-xl border p-4">
			<h2 className="text-lg font-semibold">{copy.title}</h2>
			<Field>
				<FieldLabel>{copy.context}</FieldLabel>
				<EntityPicker
					index="units"
					owners={[...ContextMeasurementOwners]}
					ariaLabel={copy.context}
					placeholder={copy.chooseContext}
					value={
						context
							? {
									id: context.reference.id,
									owner: context.reference.owner,
									label: context.label,
									shape: context.shape,
								}
							: undefined
					}
					onChange={(value) => {
						const reference = CatalogReferenceSchema.safeParse({
							owner: value.owner,
							id: value.id,
						});
						const owner = reference.success
							? ContextMeasurementOwners.find((owner) => owner === reference.data.owner)
							: undefined;
						setContext(
							reference.success && owner
								? {
										reference: { owner, id: reference.data.id },
										label: value.label,
										shape: value.shape,
									}
								: undefined,
						);
					}}
					onClear={() => setContext(undefined)}
				/>
			</Field>
			{context ? (
				<>
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
						onChange={(value) => setSpoiler(value === "0" ? 0 : value === "1" ? 1 : 2)}
					/>
					<ContextMeasurementRead
						key={`${entityId}:${context.reference.owner}:${context.reference.id}:${spoiler}`}
						entityId={entityId}
						context={context.reference}
						spoiler={spoiler}
						onSaved={onSaved}
					/>
				</>
			) : null}
		</section>
	);
}

function ContextMeasurementRead({
	entityId,
	context,
	spoiler,
	onSaved,
}: {
	entityId: string;
	context: Context;
	spoiler: 0 | 1 | 2;
	onSaved: () => void;
}) {
	const { t } = useTranslation(["entities", "units"]),
		copy = t.entities.contextMeasurements;
	const [editing, setEditing] = useState(false);
	const query = useReadEntityMeasurementContext({
		path: { id: entityId },
		query: { contextOwner: context.owner, contextId: context.id, maxSpoiler: spoiler },
	});
	if (query.isPending) return <QueryPending />;
	if (query.isError) return <QueryFailure error={query.error} retry={() => void query.refetch()} />;
	return (
		<div className="grid gap-3">
			{query.data.measurement ? (
				<dl className="grid grid-cols-2 gap-3">
					{MeasurementFields.map((field) => (
						<div key={field.key}>
							<dt>
								{t.entities[field.label]} ({copy[field.unit]})
							</dt>
							<dd>
								{query.data.measurement?.values[field.key] ?? t.units.nativeSemantics.unknown}
							</dd>
						</div>
					))}
				</dl>
			) : (
				<p>{copy.noVisibleMeasurement}</p>
			)}
			{query.data.canEdit ? (
				<Button
					variant="outline"
					aria-expanded={editing}
					onClick={() => setEditing((value) => !value)}
				>
					{copy.edit}
				</Button>
			) : null}
			{editing && query.data.canEdit ? (
				<ContextMeasurementForm
					key={`${query.data.revision}:${query.data.headVersion}`}
					entityId={entityId}
					context={context}
					current={query.data}
					onSaved={() => {
						setEditing(false);
						void query.refetch();
						onSaved();
					}}
				/>
			) : null}
		</div>
	);
}

function ContextMeasurementForm({
	entityId,
	context,
	current,
	onSaved,
}: {
	entityId: string;
	context: Context;
	current: ReadEntityMeasurementContextStatus200;
	onSaved: () => void;
}) {
	const { t } = useTranslation(["entities", "units"]),
		copy = t.entities.contextMeasurements;
	const [draft, setDraft] = useState(() => measurementDraft(current.measurement?.values)),
		[invalid, setInvalid] = useState(false);
	const [spoiler, setSpoiler] = useState<0 | 1 | 2>(
		current.measurement?.spoiler === 2 ? 2 : current.measurement?.spoiler === 1 ? 1 : 0,
	);
	const mutation = useWriteEntityMeasurementContext();
	return (
		<form
			className="grid gap-3"
			onSubmit={(event) => {
				event.preventDefault();
				if (mutation.isPending) return;
				const values = parseMeasurementDraft(draft);
				if (!values) {
					setInvalid(true);
					return;
				}
				setInvalid(false);
				void mutation
					.mutateAsync({
						path: { id: entityId },
						body: {
							expectedRevision: current.revision,
							expectedHeadVersion: current.headVersion,
							context,
							spoiler,
							values,
						},
					})
					.then(onSaved)
					.catch(() => undefined);
			}}
		>
			<p>{copy.scopeNotice}</p>
			<p>{copy.unknownNotice}</p>
			{MeasurementFields.map((field) => (
				<DefinitionText
					key={field.key}
					label={`${t.entities[field.label]} (${copy[field.unit]})`}
					value={draft[field.key]}
					onChange={(value) => setDraft((current) => ({ ...current, [field.key]: value }))}
					disabled={mutation.isPending}
				/>
			))}
			<DefinitionChoice
				label={t.units.nativeSemantics.spoiler}
				value={String(spoiler)}
				values={["0", "1", "2"]}
				labelFor={(value) =>
					value === "0"
						? t.units.nativeSemantics.spoilerNone
						: value === "1"
							? t.units.nativeSemantics.spoilerMinor
							: t.units.nativeSemantics.spoilerMajor
				}
				onChange={(value) => setSpoiler(value === "0" ? 0 : value === "1" ? 1 : 2)}
				disabled={mutation.isPending}
			/>
			{invalid ? <p role="alert">{copy.invalid}</p> : null}
			<RequestFailure error={mutation.error} />
			<Button type="submit" disabled={mutation.isPending}>
				{copy.save}
			</Button>
		</form>
	);
}
