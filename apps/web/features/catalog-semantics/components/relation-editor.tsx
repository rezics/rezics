"use client";
import { useState } from "react";
import type { CatalogReference } from "@rezics/reference";
import { useWriteCatalogRelation } from "@rezics/openapi-tanstack-query";
import { Button, EntityPicker, Field, FieldLabel } from "@rezics/ui";
import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import { DefinitionSelect } from "@/features/catalog-definitions/components/definition-select";
import {
	DefinitionText,
	DefinitionChoice,
} from "@/features/catalog-definitions/components/definition-fields";
import type {
	DefinitionSelection,
	DefinitionRevision,
} from "@/features/catalog-definitions/model/definition-draft";
import { nativeCreateSelection } from "@/features/create/model/native-create";
import {
	DefinitionLabelBatch,
	DefinitionRevisionOptions,
	ExactDefinitionName,
} from "./definition-revision-options";
import { QualifierPicker } from "./qualifier-picker";
import {
	buildRelationBody,
	type ParticipantDraft,
	type QualifierDraft,
	type Replacement,
} from "../model/semantic-draft";
export function RelationEditor({
	reference,
	revision,
	initial,
	onSaved,
}: {
	reference: CatalogReference;
	revision: number;
	initial?: {
		definition: DefinitionRevision;
		participants: ParticipantDraft[];
		qualifiers: QualifierDraft[];
		spoiler: 0 | 1 | 2;
		replaces: Replacement;
	};
	onSaved: () => void;
}) {
	const { t } = useTranslation(["units"]),
		copy = t.units.nativeSemantics;
	const [selection, setSelection] = useState<DefinitionSelection>(),
		[participants, setParticipants] = useState<ParticipantDraft[]>(initial?.participants ?? []),
		[qualifiers, setQualifiers] = useState<QualifierDraft[]>(initial?.qualifiers ?? []),
		[spoiler, setSpoiler] = useState<0 | 1 | 2>(initial?.spoiler ?? 0),
		[invalid, setInvalid] = useState(false),
		[qualifierDefinition, setQualifierDefinition] = useState<string>();
	const definition = initial?.definition ?? selection?.revision,
		roles = definition?.constraints.roles ?? [],
		mutation = useWriteCatalogRelation();
	function update(index: number, patch: Partial<ParticipantDraft>) {
		setParticipants((current) =>
			current.map((row, position) => (index === position ? { ...row, ...patch } : row)),
		);
	}
	return (
		<DefinitionLabelBatch
			ids={[
				...participants.map((value) => value.roleRevisionId).filter(Boolean),
				...qualifiers.map((value) => value.definitionRevisionId),
				...(initial ? [initial.definition.id] : []),
			]}
		>
			<form
				className="grid gap-4 rounded-xl border p-4"
				onSubmit={(event) => {
					event.preventDefault();
					if (mutation.isPending || !definition) return;
					const body = buildRelationBody(
						definition,
						participants,
						qualifiers,
						revision,
						spoiler,
						initial?.replaces,
					);
					if (!body) {
						setInvalid(true);
						return;
					}
					setInvalid(false);
					void mutation
						.mutateAsync({ path: reference, body })
						.then(onSaved)
						.catch(() => undefined);
				}}
			>
				{initial ? (
					<ExactDefinitionName id={initial.definition.id} />
				) : (
					<DefinitionSelect
						label={copy.predicate}
						kind="predicate"
						value={selection}
						onChange={(value) => {
							setSelection(value);
							setParticipants([]);
							setQualifiers([]);
							setQualifierDefinition(undefined);
						}}
					/>
				)}
				<DefinitionChoice
					label={copy.spoiler}
					value={String(spoiler)}
					values={["0", "1", "2"]}
					labelFor={(value) =>
						value === "0" ? copy.spoilerNone : value === "1" ? copy.spoilerMinor : copy.spoilerMajor
					}
					onChange={(value) => setSpoiler(value === "0" ? 0 : value === "1" ? 1 : 2)}
				/>
				{participants.map((participant, index) => {
					const role = roles.find((value) => value.roleRevisionId === participant.roleRevisionId),
						target = participant.target;
					return (
						<fieldset key={index} className="grid gap-3 rounded border p-3">
							<legend>
								{copy.participant} {index + 1}
							</legend>
							<DefinitionRevisionOptions
								label={copy.role}
								ids={roles.map((role) => role.roleRevisionId)}
								value={participant.roleRevisionId || undefined}
								onSelect={(roleRevisionId) => update(index, { roleRevisionId, target: undefined })}
							/>
							{role ? (
								<Field>
									<FieldLabel>{copy.target}</FieldLabel>
									<EntityPicker
										index="units"
										owners={[...new Set(role.targets.map((target) => target.owner))]}
										shapes={[...new Set(role.targets.flatMap((target) => target.shapes))]}
										ariaLabel={copy.target}
										placeholder={copy.chooseTarget}
										value={
											target
												? {
														id: target.reference.id,
														owner: target.reference.owner,
														shape: target.shape,
														label: target.label,
													}
												: undefined
										}
										onChange={(value) => {
											const allowed = role.targets.find(
												(target) =>
													target.owner === value.owner && target.shapes.includes(value.shape ?? ""),
											);
											update(index, {
												target: allowed
													? nativeCreateSelection(value, allowed.owner, allowed.shapes)
													: undefined,
											});
										}}
										onClear={() => update(index, { target: undefined })}
									/>
								</Field>
							) : null}
							<DefinitionText
								label={copy.creditedAs}
								value={participant.creditedAs}
								onChange={(creditedAs) => update(index, { creditedAs })}
							/>
							<Button
								type="button"
								variant="ghost"
								onClick={() =>
									setParticipants((current) => current.filter((_, position) => position !== index))
								}
							>
								{copy.remove}
							</Button>
						</fieldset>
					);
				})}
				{definition ? (
					<Button
						type="button"
						variant="outline"
						disabled={participants.length >= 128 || !roles.length}
						onClick={() =>
							setParticipants((current) => [...current, { roleRevisionId: "", creditedAs: "" }])
						}
					>
						{copy.addParticipant}
					</Button>
				) : null}
				{qualifiers.map((qualifier, index) => (
					<div key={qualifier.definitionRevisionId} className="flex items-center gap-3">
						<ExactDefinitionName id={qualifier.definitionRevisionId} />
						<span>{copy.valueSelected}</span>
						<Button
							type="button"
							variant="ghost"
							onClick={() =>
								setQualifiers((current) => current.filter((_, position) => index !== position))
							}
						>
							{copy.remove}
						</Button>
					</div>
				))}
				{definition?.constraints.qualifierRevisionIds?.length && qualifiers.length < 64 ? (
					<>
						<DefinitionRevisionOptions
							label={copy.addQualifier}
							ids={definition.constraints.qualifierRevisionIds.filter(
								(id) => !qualifiers.some((qualifier) => qualifier.definitionRevisionId === id),
							)}
							value={qualifierDefinition}
							onSelect={setQualifierDefinition}
						/>
						{qualifierDefinition ? (
							<QualifierPicker
								key={qualifierDefinition}
								reference={reference}
								definitionRevisionId={qualifierDefinition}
								spoiler={spoiler}
								onPick={(valueFactId) => {
									setQualifiers((current) => [
										...current,
										{ definitionRevisionId: qualifierDefinition, valueFactId },
									]);
									setQualifierDefinition(undefined);
								}}
							/>
						) : null}
					</>
				) : null}
				{invalid ? <p role="alert">{copy.invalid}</p> : null}
				{mutation.error ? <RequestFailure error={mutation.error} /> : null}
				<Button type="submit" disabled={!definition || mutation.isPending}>
					{copy.saveRelation}
				</Button>
			</form>
		</DefinitionLabelBatch>
	);
}
