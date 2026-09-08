"use client";
import { useState } from "react";
import { useGetCatalogDefinitionRevision } from "@rezics/openapi-tanstack-query";
import { Button, QueryFailure, QueryPending } from "@rezics/ui";
import { useTranslation } from "@/i18n/client";
import type { DefinitionRevision } from "@/features/catalog-definitions/model/definition-draft";
import {
	DefinitionText,
	DefinitionChoice,
	DefinitionFlag,
} from "@/features/catalog-definitions/components/definition-fields";
import { DefinitionRevisionOptions } from "./definition-revision-options";
import {
	valueRules,
	addValueNode,
	removeValueNode,
	setValueUnknown,
	type ValueDraftNode,
	type ValueRule,
} from "../model/semantic-draft";
export function ValueEditor({
	definition,
	rows,
	onChange,
}: {
	definition: DefinitionRevision;
	rows: readonly ValueDraftNode[];
	onChange: (rows: ValueDraftNode[]) => void;
}) {
	const { t } = useTranslation(["units"]),
		copy = t.units.nativeSemantics,
		rules = valueRules(definition);
	function change(index: number, patch: Partial<ValueDraftNode>) {
		onChange(rows.map((row, position) => (position === index ? { ...row, ...patch } : row)));
	}
	return (
		<div className="grid gap-3">
			{rows.map((row, index) => {
				const rule = rules[row.rulePosition];
				if (!rule) return null;
				const children = rules.filter(
					(child) =>
						child.parent === rule.position &&
						(rule.kind === "array" ||
							!rows.some(
								(current) =>
									current.parentPosition === index && current.rulePosition === child.position,
							)),
				);
				return (
					<fieldset key={index} className="grid gap-3 rounded border p-3">
						<legend className="px-1 text-sm">
							{index === 0 ? copy.value : (rule.memberKey ?? `${copy.item} ${index}`)}
						</legend>
						{rule.nullable && rule.kind !== "null" ? (
							<DefinitionFlag
								label={copy.unknown}
								value={row.unknown}
								onChange={(value) => onChange(setValueUnknown(rows, index, value))}
							/>
						) : null}
						{!row.unknown ? (
							<>
								{rule.vocabularyRevisionId && rule.kind === "string" ? (
									<VocabularyValue
										revisionId={rule.vocabularyRevisionId}
										value={row.text}
										onChange={(text) => change(index, { text })}
									/>
								) : rule.allowedValues?.length ? (
									<AllowedValue row={row} rule={rule} onChange={(patch) => change(index, patch)} />
								) : rule.kind === "string" ? (
									<DefinitionText
										label={copy.value}
										value={row.text}
										onChange={(text) => change(index, { text })}
										multiline
									/>
								) : rule.kind === "number" ? (
									<DefinitionText
										label={copy.value}
										value={row.number}
										onChange={(number) => change(index, { number })}
										required
									/>
								) : rule.kind === "boolean" ? (
									<DefinitionFlag
										label={copy.trueValue}
										value={row.boolean}
										onChange={(boolean) => change(index, { boolean })}
									/>
								) : rule.kind === "null" ? (
									<p>{copy.unknown}</p>
								) : null}
								{rule.unit ? (
									<p className="text-sm">
										{t.units.nativeDefinitions.unit}: {rule.unit}
									</p>
								) : null}
								{(rule.kind === "array" || rule.kind === "object") && children.length ? (
									<div className="flex flex-wrap gap-2">
										{children.map((child) => (
											<Button
												type="button"
												variant="outline"
												key={child.position}
												disabled={rows.length >= 512}
												onClick={() => {
													const next = addValueNode(rows, rules, index, child.position);
													if (next) onChange(next);
												}}
											>
												{copy.add}: {child.memberKey ?? copy.item}
											</Button>
										))}
									</div>
								) : null}
							</>
						) : null}
						{index > 0 ? (
							<Button
								type="button"
								variant="ghost"
								onClick={() => onChange(removeValueNode(rows, index))}
							>
								{copy.remove}
							</Button>
						) : null}
					</fieldset>
				);
			})}
		</div>
	);
}
function AllowedValue({
	row,
	rule,
	onChange,
}: {
	row: ValueDraftNode;
	rule: ValueRule;
	onChange: (patch: Partial<ValueDraftNode>) => void;
}) {
	const { t } = useTranslation(["units"]),
		copy = t.units.nativeSemantics;
	const values = (rule.allowedValues ?? []).filter((value) => typeof value === rule.kind);
	const current =
		rule.kind === "number"
			? row.number.trim()
				? Number(row.number)
				: undefined
			: rule.kind === "boolean"
				? row.boolean
				: row.text;
	const selected = values.findIndex((value) => value === current);
	return (
		<DefinitionChoice
			label={copy.value}
			value={selected < 0 ? "unset" : String(selected)}
			values={["unset", ...values.map((_, index) => String(index))]}
			labelFor={(index) => {
				const value = values[Number(index)];
				return index === "unset"
					? copy.chooseValue
					: typeof value === "boolean"
						? value
							? copy.trueValue
							: copy.falseValue
						: typeof value === "string"
							? `“${value}”`
							: String(value);
			}}
			onChange={(index) => {
				if (index === "unset") return;
				const value = values[Number(index)];
				if (typeof value === "string") onChange({ text: value });
				else if (typeof value === "number") onChange({ number: String(value) });
				else if (typeof value === "boolean") onChange({ boolean: value });
			}}
		/>
	);
}
function VocabularyValue({
	revisionId,
	value,
	onChange,
}: {
	revisionId: string;
	value: string;
	onChange: (value: string) => void;
}) {
	const { t } = useTranslation(["units"]),
		[open, setOpen] = useState(false);
	return (
		<div className="grid gap-3">
			<Button
				type="button"
				variant="outline"
				aria-expanded={open}
				onClick={() => setOpen((current) => !current)}
			>
				{t.units.nativeSemantics.chooseVocabularyValue}
			</Button>
			{open ? (
				<VocabularyChoices revisionId={revisionId} value={value} onChange={onChange} />
			) : value ? (
				<p>{t.units.nativeSemantics.valueSelected}</p>
			) : null}
		</div>
	);
}
function VocabularyChoices({
	revisionId,
	value,
	onChange,
}: {
	revisionId: string;
	value: string;
	onChange: (value: string) => void;
}) {
	const { t } = useTranslation(["units"]),
		query = useGetCatalogDefinitionRevision({ path: { id: revisionId } });
	if (query.isPending) return <QueryPending />;
	if (query.isError) return <QueryFailure error={query.error} retry={() => void query.refetch()} />;
	return (
		<DefinitionRevisionOptions
			label={t.units.nativeSemantics.value}
			ids={query.data.constraints.memberRevisionIds ?? []}
			value={value || undefined}
			onSelect={onChange}
		/>
	);
}
