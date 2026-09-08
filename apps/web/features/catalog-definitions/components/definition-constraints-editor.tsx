"use client";
import { useState } from "react";
import type { Translation } from "@rezics/i18n";
import { DefinitionBrowser } from "./definition-select";
import { CatalogOwnerValues, type CatalogOwner } from "@rezics/reference";
import { Button } from "@rezics/ui";
import { useTranslation } from "@/i18n/client";
import {
	NativeEntityShapes,
	NativeProgramShapes,
	NativeReferenceShapes,
} from "@/features/create/model/native-create";
import {
	DefinitionChoice,
	DefinitionFlag,
	DefinitionNumber,
	DefinitionText,
} from "./definition-fields";
import { DefinitionRevisionLabel, DefinitionRevisionPicker } from "./definition-revision-picker";
import {
	DefinitionValueKinds,
	type DefinitionConstraints,
	type DefinitionKind,
	type DefinitionValueKind,
} from "../model/definition-draft";
const shapes = {
	publishing: ["work", "text_version", "publication", "serialization"],
	music: ["work", "recording", "release_group", "release"],
	software: ["content", "version", "release"],
	program: NativeProgramShapes,
	entity: NativeEntityShapes,
	grouping: ["grouping"],
	reference: NativeReferenceShapes,
	distribution: ["package"],
} satisfies Record<CatalogOwner, readonly string[]>;
type Targets = NonNullable<DefinitionConstraints["targets"]>;
type Scalar = Pick<
	DefinitionConstraints,
	| "nullable"
	| "integer"
	| "minimum"
	| "maximum"
	| "minLength"
	| "maxLength"
	| "unit"
	| "allowedValues"
	| "vocabularyRevisionId"
>;
export function DefinitionTargetsEditor({
	value,
	onChange,
}: {
	value: Targets;
	onChange: (value: Targets) => void;
}) {
	const { t } = useTranslation(["units", "create"]),
		copy = t.units.nativeDefinitions;
	return (
		<fieldset className="grid gap-3">
			<legend className="mb-2 font-medium">{copy.targets}</legend>
			{value.map((target, index) => (
				<div key={index} className="grid gap-3 rounded-xl border p-3">
					<DefinitionChoice
						label={copy.targets}
						value={target.owner}
						values={CatalogOwnerValues}
						labelFor={(owner) => t.create.sections[owner].label}
						onChange={(owner) =>
							onChange(value.map((item, i) => (i === index ? { owner, shapes: [] } : item)))
						}
					/>
					<fieldset className="flex flex-wrap gap-3">
						<legend className="mb-2 text-sm">{copy.shapes}</legend>
						{shapes[target.owner].map((shape) => (
							<DefinitionFlag
								key={shape}
								label={shapeLabel(t.create.native, target.owner, shape)}
								value={target.shapes.includes(shape)}
								onChange={(checked) =>
									onChange(
										value.map((item, i) =>
											i === index
												? {
														...item,
														shapes: checked
															? [...item.shapes, shape]
															: item.shapes.filter((existing) => existing !== shape),
													}
												: item,
										),
									)
								}
							/>
						))}
					</fieldset>
					<Button
						type="button"
						variant="ghost"
						onClick={() => onChange(value.filter((_, i) => i !== index))}
					>
						{copy.remove}
					</Button>
				</div>
			))}
			<Button
				type="button"
				variant="outline"
				disabled={value.length >= 32}
				onClick={() => onChange([...value, { owner: "publishing", shapes: [] }])}
			>
				{copy.add}
			</Button>
		</fieldset>
	);
}
type NativeLabels = Translation["create"]["native"];
function shapeLabel(copy: NativeLabels, owner: CatalogOwner, shape: string) {
	if (owner === "entity") {
		const value = NativeEntityShapes.find((value) => value === shape);
		if (value) return copy.entityShapes[value];
	}
	if (owner === "program") {
		const value = NativeProgramShapes.find((value) => value === shape);
		if (value) return copy.programShapes[value];
	}
	if (owner === "reference") {
		const value = NativeReferenceShapes.find((value) => value === shape);
		if (value) return copy.referenceShapes[value];
	}
	const mapping = {
		publishing: {
			work: copy.kinds.publishing_work,
			text_version: copy.kinds.text_version,
			publication: copy.kinds.publication,
			serialization: copy.kinds.serialization,
		},
		music: {
			work: copy.kinds.musical_work,
			recording: copy.kinds.recording,
			release_group: copy.kinds.release_group,
			release: copy.kinds.music_release,
		},
		software: {
			content: copy.kinds.software_content,
			version: copy.kinds.software_version,
			release: copy.kinds.software_release,
		},
		grouping: { grouping: copy.kinds.grouping },
		distribution: { package: copy.kinds.distribution },
	};
	for (const [candidate, labels] of Object.entries(mapping))
		if (candidate === owner)
			for (const [key, label] of Object.entries(labels)) if (key === shape) return label;
	return shape;
}
export function DefinitionScalarEditor({
	value,
	onChange,
}: {
	value: Scalar;
	onChange: (value: Scalar) => void;
}) {
	const { t } = useTranslation(["units"]),
		copy = t.units.nativeDefinitions;
	return (
		<div className="grid gap-3">
			<div className="flex flex-wrap gap-3">
				<DefinitionFlag
					label={copy.nullable}
					value={value.nullable ?? false}
					onChange={(nullable) => onChange({ ...value, nullable })}
				/>
				<DefinitionFlag
					label={copy.integer}
					value={value.integer ?? false}
					onChange={(integer) => onChange({ ...value, integer })}
				/>
			</div>
			<div className="grid gap-3 sm:grid-cols-2">
				<DefinitionNumber
					label={copy.minimum}
					value={value.minimum}
					onChange={(minimum) => onChange({ ...value, minimum })}
				/>
				<DefinitionNumber
					label={copy.maximum}
					value={value.maximum}
					onChange={(maximum) => onChange({ ...value, maximum })}
				/>
				<DefinitionNumber
					label={copy.minLength}
					min={0}
					max={131072}
					integer
					value={value.minLength}
					onChange={(minLength) => onChange({ ...value, minLength })}
				/>
				<DefinitionNumber
					label={copy.maxLength}
					min={0}
					max={131072}
					integer
					value={value.maxLength}
					onChange={(maxLength) => onChange({ ...value, maxLength })}
				/>
			</div>
			<DefinitionText
				label={copy.unit}
				value={value.unit ?? ""}
				onChange={(unit) => onChange({ ...value, unit: unit || undefined })}
			/>
			<DefinitionRevisionPicker
				label={copy.vocabulary}
				kind="vocabulary"
				value={value.vocabularyRevisionId}
				onChange={(vocabularyRevisionId) => onChange({ ...value, vocabularyRevisionId })}
			/>
			<fieldset className="grid gap-3">
				<legend>{copy.allowedValues}</legend>
				{value.allowedValues?.map((item, index) => (
					<div className="flex flex-wrap items-end gap-3" key={index}>
						<DefinitionChoice
							label={copy.valueKind}
							value={
								typeof item === "number"
									? "number"
									: typeof item === "boolean"
										? "boolean"
										: "string"
							}
							values={["string", "number", "boolean"]}
							labelFor={(kind) => copy.valueKinds[kind]}
							onChange={(kind) =>
								onChange({
									...value,
									allowedValues: value.allowedValues?.map((existing, i) =>
										i === index
											? kind === "number"
												? 0
												: kind === "boolean"
													? false
													: ""
											: existing,
									),
								})
							}
						/>
						{typeof item === "boolean" ? (
							<DefinitionFlag
								label={copy.valueKinds.boolean}
								value={item}
								onChange={(next) =>
									onChange({
										...value,
										allowedValues: value.allowedValues?.map((existing, i) =>
											i === index ? next : existing,
										),
									})
								}
							/>
						) : typeof item === "number" ? (
							<DefinitionNumber
								label={copy.valueKinds.number}
								value={item}
								onChange={(next) =>
									onChange({
										...value,
										allowedValues: value.allowedValues?.map((existing, i) =>
											i === index ? (next ?? 0) : existing,
										),
									})
								}
							/>
						) : (
							<DefinitionText
								label={copy.valueKinds.string}
								value={item}
								onChange={(next) =>
									onChange({
										...value,
										allowedValues: value.allowedValues?.map((existing, i) =>
											i === index ? next : existing,
										),
									})
								}
							/>
						)}
						<Button
							type="button"
							variant="ghost"
							onClick={() =>
								onChange({
									...value,
									allowedValues: value.allowedValues?.filter((_, i) => i !== index),
								})
							}
						>
							{copy.remove}
						</Button>
					</div>
				))}
				<Button
					type="button"
					variant="outline"
					disabled={(value.allowedValues?.length ?? 0) >= 512}
					onClick={() =>
						onChange({ ...value, allowedValues: [...(value.allowedValues ?? []), ""] })
					}
				>
					{copy.add}
				</Button>
			</fieldset>
		</div>
	);
}
export function DefinitionConstraintsEditor({
	kind,
	valueKind,
	value,
	onChange,
}: {
	kind: DefinitionKind;
	valueKind: DefinitionValueKind;
	value: DefinitionConstraints;
	onChange: (value: DefinitionConstraints) => void;
}) {
	const { t } = useTranslation(["units"]),
		copy = t.units.nativeDefinitions;
	const roles = value.roles ?? [],
		rules = value.rules ?? [];
	return (
		<fieldset className="grid gap-5">
			<legend className="mb-3 font-semibold">{copy.constraints}</legend>
			<DefinitionTargetsEditor
				value={value.targets ?? []}
				onChange={(targets) => onChange({ ...value, targets })}
			/>
			<DefinitionText
				label={copy.slots}
				value={value.slots?.join("\n") ?? ""}
				multiline
				onChange={(text) => onChange({ ...value, slots: text.split("\n").filter(Boolean) })}
			/>
			{kind === "property" ? (
				<DefinitionScalarEditor
					value={value}
					onChange={(scalar) => onChange({ ...value, ...scalar })}
				/>
			) : null}
			{kind === "predicate" ? (
				<>
					<fieldset className="grid gap-3">
						<legend>{copy.roles}</legend>
						{roles.map((role, index) => (
							<div className="grid gap-3 rounded-xl border p-3" key={index}>
								<DefinitionRevisionPicker
									label={copy.role}
									kind="role"
									value={role.roleRevisionId || undefined}
									onChange={(id) =>
										onChange({
											...value,
											roles: roles.map((item, i) =>
												i === index ? { ...item, roleRevisionId: id ?? "" } : item,
											),
										})
									}
								/>
								<div className="grid gap-3 sm:grid-cols-2">
									<DefinitionNumber
										label={copy.minParticipants}
										value={role.min}
										integer
										min={0}
										max={128}
										onChange={(min) =>
											onChange({
												...value,
												roles: roles.map((item, i) =>
													i === index ? { ...item, min: min ?? 0 } : item,
												),
											})
										}
									/>
									<DefinitionNumber
										label={copy.maxParticipants}
										value={role.max}
										integer
										min={1}
										max={128}
										onChange={(max) =>
											onChange({
												...value,
												roles: roles.map((item, i) =>
													i === index ? { ...item, max: max ?? 1 } : item,
												),
											})
										}
									/>
								</div>
								<DefinitionTargetsEditor
									value={role.targets}
									onChange={(targets) =>
										onChange({
											...value,
											roles: roles.map((item, i) => (i === index ? { ...item, targets } : item)),
										})
									}
								/>
								<Button
									type="button"
									variant="ghost"
									onClick={() => onChange({ ...value, roles: roles.filter((_, i) => i !== index) })}
								>
									{copy.remove}
								</Button>
							</div>
						))}
						<Button
							type="button"
							variant="outline"
							disabled={roles.length >= 32}
							onClick={() =>
								onChange({
									...value,
									roles: [...roles, { roleRevisionId: "", min: 1, max: 1, targets: [] }],
								})
							}
						>
							{copy.add}
						</Button>
					</fieldset>
					<DefinitionDependencyList
						label={copy.qualifiers}
						kinds={["property"]}
						value={value.qualifierRevisionIds ?? []}
						max={64}
						onChange={(qualifierRevisionIds) => onChange({ ...value, qualifierRevisionIds })}
					/>
				</>
			) : null}
			{kind === "vocabulary" || kind === "class" ? (
				<DefinitionDependencyList
					label={copy.members}
					kinds={["class", "vocabulary"]}
					value={value.memberRevisionIds ?? []}
					max={512}
					onChange={(memberRevisionIds) => onChange({ ...value, memberRevisionIds })}
				/>
			) : null}
			{kind === "property" &&
			(valueKind === "object" || valueKind === "array" || rules.length > 0) ? (
				<fieldset className="grid gap-3">
					<legend>{copy.rules}</legend>
					{rules.map((rule, index) => (
						<div key={index} className="grid gap-3 rounded-xl border p-3">
							<span>{index === 0 ? copy.root : index}</span>
							<DefinitionChoice
								label={copy.valueKind}
								value={rule.kind}
								values={DefinitionValueKinds}
								labelFor={(kind) => copy.valueKinds[kind]}
								disabled={index === 0}
								onChange={(kind) =>
									onChange({
										...value,
										rules: rules.map((item, i) => (i === index ? { ...item, kind } : item)),
									})
								}
							/>
							{index > 0 ? (
								<>
									<DefinitionNumber
										label={copy.parent}
										value={rule.parent ?? undefined}
										integer
										min={0}
										max={index - 1}
										onChange={(parent) =>
											onChange({
												...value,
												rules: rules.map((item, i) =>
													i === index
														? {
																...item,
																parent: parent ?? 0,
																memberKey:
																	rules[parent ?? 0]?.kind === "array"
																		? null
																		: (item.memberKey ?? ""),
															}
														: item,
												),
											})
										}
									/>
									{rules[rule.parent ?? 0]?.kind !== "array" ? (
										<DefinitionText
											label={copy.memberKey}
											value={rule.memberKey ?? ""}
											onChange={(memberKey) =>
												onChange({
													...value,
													rules: rules.map((item, i) =>
														i === index ? { ...item, memberKey } : item,
													),
												})
											}
										/>
									) : null}
								</>
							) : null}
							<DefinitionScalarEditor
								value={rule}
								onChange={(scalar) =>
									onChange({
										...value,
										rules: rules.map((item, i) => (i === index ? { ...item, ...scalar } : item)),
									})
								}
							/>
							{index === rules.length - 1 ? (
								<Button
									type="button"
									variant="ghost"
									onClick={() => onChange({ ...value, rules: rules.slice(0, -1) })}
								>
									{copy.remove}
								</Button>
							) : null}
						</div>
					))}
					<Button
						type="button"
						variant="outline"
						disabled={rules.length >= 128}
						onClick={() =>
							onChange({
								...value,
								rules: [
									...rules,
									{
										position: rules.length,
										parent: rules.length ? 0 : null,
										memberKey: rules.length && rules[0]?.kind === "object" ? "" : null,
										kind: rules.length ? "string" : valueKind,
										nullable: false,
										integer: false,
									},
								],
							})
						}
					>
						{copy.add}
					</Button>
				</fieldset>
			) : null}
		</fieldset>
	);
}
function DefinitionDependencyList({
	label,
	kinds,
	value,
	max,
	onChange,
}: {
	label: string;
	kinds: readonly DefinitionKind[];
	value: string[];
	max: number;
	onChange: (ids: string[]) => void;
}) {
	const { t } = useTranslation(["units"]),
		copy = t.units.nativeDefinitions;
	const [kind, setKind] = useState<DefinitionKind>(kinds[0] ?? "property"),
		[open, setOpen] = useState(false);
	return (
		<fieldset className="grid gap-3">
			<legend>{label}</legend>
			{value.map((id, index) => (
				<div key={`${id}:${index}`} className="flex flex-wrap gap-3">
					<DefinitionRevisionLabel id={id} />
					<Button
						type="button"
						variant="ghost"
						onClick={() => onChange(value.filter((_, i) => i !== index))}
					>
						{copy.remove}
					</Button>
				</div>
			))}
			{kinds.length > 1 ? (
				<DefinitionChoice
					label={copy.kind}
					value={kind}
					values={kinds}
					labelFor={(kind) => copy.kinds[kind]}
					onChange={setKind}
				/>
			) : null}
			<Button
				type="button"
				variant="outline"
				disabled={value.length >= max}
				aria-expanded={open}
				onClick={() => setOpen((current) => !current)}
			>
				{copy.add}
			</Button>
			{open ? (
				<DefinitionBrowser
					key={kind}
					kind={kind}
					onPick={(selected) => {
						if (!value.includes(selected.revision.id)) onChange([...value, selected.revision.id]);
						setOpen(false);
					}}
				/>
			) : null}
		</fieldset>
	);
}
