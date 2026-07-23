"use client";

import type {
	ResolvedSearchControl,
	SearchControlValue,
	SearchFeatureDefinition,
	SearchFeatureState,
	SearchField,
	SearchFilter,
	SearchInjection,
	SearchMode,
	SearchOperator,
	SearchScalar,
} from "@rezics/search";
import {
	Badge,
	Button,
	ChoiceSelect,
	Field,
	FieldGroup,
	FieldLabel,
	Input,
	Spinner,
} from "@rezics/ui";
import { Eye, EyeOff, Search, X } from "lucide-react";
import { useMemo, useState, type FormEvent, type ReactNode } from "react";

import { useTranslation } from "@/i18n/client";

export interface SearchFeatureFacet {
	readonly controlKey?: string;
	readonly field: string;
	readonly options: readonly { readonly value: string }[];
}

export interface SearchFeatureRequest {
	readonly injections: SearchInjection[];
	readonly state: SearchFeatureState;
}

function sameScalar(left: SearchScalar, right: SearchScalar): boolean {
	return typeof left === typeof right && left === right;
}

function optionIsVisible(control: ResolvedSearchControl, value: SearchScalar): boolean {
	const policy = control.optionPolicy;
	if (!policy || policy.kind === "all") return true;
	const listed = policy.values.some((candidate) => sameScalar(candidate, value));
	return policy.kind === "include" ? listed : !listed;
}

function selectedValues(filter: SearchFilter | undefined): readonly SearchScalar[] {
	if (!filter) return [];
	if ("values" in filter) return filter.values;
	if ("value" in filter) return [filter.value];
	return [];
}

function selectionFilter(
	control: ResolvedSearchControl,
	operator: SearchOperator,
	values: readonly SearchScalar[],
): SearchFilter | undefined {
	if (operator === "range" || values.length === 0) return undefined;
	if (operator === "exists") return { field: control.field, operator, value: values[0] === true };
	if (operator === "equals" || operator === "not-equals") {
		const value = values[0];
		return value === undefined ? undefined : { field: control.field, operator, value };
	}
	return { field: control.field, operator, values: [...values] };
}

function rangeFilter(
	field: SearchField,
	lower: SearchScalar | undefined,
	upper: SearchScalar | undefined,
): SearchFilter | undefined {
	if (lower !== undefined)
		return upper === undefined
			? { field, operator: "range", lower }
			: { field, operator: "range", lower, upper };
	return upper === undefined ? undefined : { field, operator: "range", upper };
}

function parseRangeValue(control: ResolvedSearchControl, value: string): SearchScalar | undefined {
	if (!value) return undefined;
	if (control.component !== "value-range") return value;
	const parsed = Number(value);
	return Number.isSafeInteger(parsed) ? parsed : undefined;
}

function rangeValue(value: SearchScalar | undefined): string {
	return value === undefined || typeof value === "boolean" ? "" : String(value);
}

export function SearchFeature({
	id,
	definition,
	initialQuery,
	injections = [],
	onInjectionsChange,
	onExecute,
	pending,
	error,
	facets,
	children,
	resolveLabel,
	resolveOptionLabel,
}: {
	id: string;
	definition: SearchFeatureDefinition;
	initialQuery?: string;
	injections?: readonly SearchInjection[];
	onInjectionsChange?: (injections: readonly SearchInjection[]) => void;
	onExecute: (request: SearchFeatureRequest) => void;
	pending: boolean;
	error: boolean;
	facets?: readonly SearchFeatureFacet[];
	children?: ReactNode;
	resolveLabel?: (labelUnitId: string) => string | undefined;
	resolveOptionLabel?: (
		control: ResolvedSearchControl,
		value: SearchScalar,
	) => string | undefined;
}) {
	const { t } = useTranslation("search");
	const { document, controls } = definition;
	const [mode, setMode] = useState<SearchMode>(document.modes.default);
	const [query, setQuery] = useState(initialQuery ?? document.query.initial ?? "");
	const [showHidden, setShowHidden] = useState(false);
	const [advancedCombination, setAdvancedCombination] = useState<"all" | "any">("all");
	const [values, setValues] = useState<readonly SearchControlValue[]>(document.defaults);
	const [operators, setOperators] = useState<Readonly<Record<string, SearchOperator>>>(() =>
		Object.fromEntries(
			controls.map((control) => {
				const defaultOperator = document.defaults.find(
					(value) => value.controlKey === control.key,
				)?.filter.operator;
				return [
					control.key,
					defaultOperator ??
						(control.component === "multi-select" &&
						control.operators.includes("any-of")
							? "any-of"
							: control.operators[0]) ??
						"equals",
				];
			}),
		),
	);
	const operatorLabels: Record<SearchOperator, string> = {
		equals: t.operators.equals,
		"not-equals": t.operators.notEquals,
		"any-of": t.operators.anyOf,
		"all-of": t.operators.allOf,
		"none-of": t.operators.noneOf,
		range: t.operators.range,
		exists: t.operators.exists,
	};
	const activeControls = useMemo(
		() =>
			controls.filter(
				(control) =>
					control.modes.includes(mode) &&
					(control.disclosure === "visible" || showHidden),
			),
		[controls, mode, showHidden],
	);
	const hiddenCount = controls.filter(
		(control) => control.modes.includes(mode) && control.disclosure === "hidden",
	).length;
	const replaceValue = (controlKey: string, filter?: SearchFilter) =>
		setValues((current) => [
			...current.filter((value) => value.controlKey !== controlKey),
			...(filter ? [{ controlKey, filter }] : []),
		]);

	function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const active = values.filter((value) =>
			controls.some(
				(control) => control.key === value.controlKey && control.modes.includes(mode),
			),
		);
		onExecute({
			injections: [...injections],
			state:
				mode === "basic"
					? { mode, query, values: active }
					: {
							mode,
							query,
							expression:
								active.length === 0
									? undefined
									: active.length === 1
										? active[0]
										: { operator: advancedCombination, clauses: active },
						},
		});
	}

	return (
		<form className="rounded-xl border border-border-weak bg-card p-4" onSubmit={submit}>
			{injections.length ? (
				<div aria-label={t.appliedContext} className="mb-4 flex flex-wrap gap-2">
					{injections.map((injection, index) => (
						<Badge key={`${injection.source}:${injection.value.controlKey}:${index}`}>
							{t.injectionSources[injection.source]}:{" "}
							{selectedValues(injection.value.filter)
								.map((value) => {
									const control = controls.find(
										(candidate) => candidate.key === injection.value.controlKey,
									);
									return (
										(control
											? resolveOptionLabel?.(control, value)
											: undefined) ?? String(value)
									);
								})
								.join(", ")}
							{injection.removable && onInjectionsChange ? (
								<button
									aria-label={t.removeAppliedContext}
									onClick={() =>
										onInjectionsChange(
											injections.filter(
												(_, candidate) => candidate !== index,
											),
										)
									}
									type="button"
								>
									<X aria-hidden className="size-3" />
								</button>
							) : null}
						</Badge>
					))}
				</div>
			) : null}
			<div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_12rem]">
				{document.query.enabled ? (
					<Field>
						<FieldLabel htmlFor={`${id}-query`}>{t.query}</FieldLabel>
						<Input
							id={`${id}-query`}
							maxLength={500}
							onChange={(event) => setQuery(event.currentTarget.value)}
							placeholder={t.placeholder}
							required={document.query.required}
							type="search"
							value={query}
						/>
					</Field>
				) : null}
				{document.modes.available.length > 1 ? (
					<Field>
						<FieldLabel>{t.mode}</FieldLabel>
						<ChoiceSelect
							appearance="field"
							ariaLabel={t.mode}
							onValueChange={(selected) => {
								const next = selected[0];
								if (next === "basic" || next === "advanced") setMode(next);
							}}
							options={document.modes.available.map((value) => ({
								value,
								label: value === "basic" ? t.modes.basic : t.modes.advanced,
							}))}
							placeholder={t.mode}
							value={[mode]}
						/>
					</Field>
				) : null}
			</div>
			{hiddenCount ? (
				<Button
					className="mt-3"
					onClick={() => setShowHidden((current) => !current)}
					size="sm"
					type="button"
					variant="quiet"
				>
					{showHidden ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
					{showHidden ? t.hideHiddenFilters : t.showHiddenFilters({ count: hiddenCount })}
				</Button>
			) : null}
			{mode === "advanced" ? (
				<Field className="mt-4 max-w-sm">
					<FieldLabel>{t.advancedCombination}</FieldLabel>
					<ChoiceSelect
						appearance="field"
						ariaLabel={t.advancedCombination}
						onValueChange={(selected) => {
							const next = selected[0];
							if (next === "all" || next === "any") setAdvancedCombination(next);
						}}
						options={(
							[
								["all", t.advancedCombinations.all],
								["any", t.advancedCombinations.any],
							] as const
						).map(([value, label]) => ({ value, label }))}
						placeholder={t.advancedCombination}
						value={[advancedCombination]}
					/>
				</Field>
			) : null}
			{activeControls.length ? (
				<FieldGroup aria-label={t.filters} className="mt-4 grid gap-3 sm:grid-cols-2">
					{activeControls.map((control) => {
						const configured = values.find((value) => value.controlKey === control.key);
						const filter = configured?.filter;
						const operator = operators[control.key] ?? control.operators[0] ?? "equals";
						const label =
							(control.labelUnitId
								? resolveLabel?.(control.labelUnitId)
								: undefined) ?? t.fields[control.field];
						const facetOptions =
							facets?.find(
								(facet) =>
									facet.controlKey === control.key ||
									(!facet.controlKey && facet.field === control.field),
							)?.options ?? [];
						const candidates =
							control.optionSource?.kind === "static"
								? control.optionSource.options.map((option) => option.value)
								: control.component === "toggle" || operator === "exists"
									? [true, false]
									: facetOptions.map((option) => option.value);
						const scalars = candidates.filter((value) =>
							optionIsVisible(control, value),
						);
						const scalarByKey = new Map(
							scalars.map((value) => [JSON.stringify(value), value]),
						);
						const options = scalars.map((value) => ({
							value: JSON.stringify(value),
							label:
								resolveOptionLabel?.(control, value) ??
								(typeof value === "boolean"
									? value
										? t.boolean.yes
										: t.boolean.no
									: String(value)),
						}));
						const selected = selectedValues(filter).map((value) =>
							JSON.stringify(value),
						);
						const lower = filter && "lower" in filter ? filter.lower : undefined;
						const upper = filter && "upper" in filter ? filter.upper : undefined;
						return (
							<Field key={control.key}>
								<FieldLabel>{label}</FieldLabel>
								{control.operators.length > 1 ? (
									<ChoiceSelect
										appearance="field"
										ariaLabel={`${label} · ${t.operator}`}
										onValueChange={(selectedOperators) => {
											const next = selectedOperators[0] as
												SearchOperator | undefined;
											if (!next) return;
											setOperators((current) => ({
												...current,
												[control.key]: next,
											}));
											replaceValue(
												control.key,
												selectionFilter(
													control,
													next,
													selectedValues(filter),
												),
											);
										}}
										options={control.operators.map((value) => ({
											value,
											label: operatorLabels[value],
										}))}
										placeholder={t.operator}
										value={[operator]}
									/>
								) : null}
								{operator === "range" ? (
									<div className="grid grid-cols-2 gap-2">
										<Input
											aria-label={`${label} · ${t.rangeLower}`}
											onChange={(event) =>
												replaceValue(
													control.key,
													rangeFilter(
														control.field,
														parseRangeValue(
															control,
															event.currentTarget.value,
														),
														upper,
													),
												)
											}
											placeholder={t.rangeLower}
											type={
												control.component === "date-range"
													? "date"
													: "number"
											}
											value={rangeValue(lower)}
										/>
										<Input
											aria-label={`${label} · ${t.rangeUpper}`}
											onChange={(event) =>
												replaceValue(
													control.key,
													rangeFilter(
														control.field,
														lower,
														parseRangeValue(
															control,
															event.currentTarget.value,
														),
													),
												)
											}
											placeholder={t.rangeUpper}
											type={
												control.component === "date-range"
													? "date"
													: "number"
											}
											value={rangeValue(upper)}
										/>
									</div>
								) : (
									<ChoiceSelect
										appearance="field"
										ariaLabel={label}
										multiple={
											operator === "any-of" ||
											operator === "all-of" ||
											operator === "none-of"
										}
										onValueChange={(keys) => {
											const next = keys.flatMap((key) => {
												const value = scalarByKey.get(key);
												return value === undefined ? [] : [value];
											});
											replaceValue(
												control.key,
												selectionFilter(control, operator, next),
											);
										}}
										options={options}
										placeholder={t.selectFilter}
										value={selected}
									/>
								)}
							</Field>
						);
					})}
				</FieldGroup>
			) : null}
			<div className="mt-4 flex justify-end">
				<Button disabled={pending} type="submit" variant="solid">
					{pending ? <Spinner aria-hidden /> : <Search aria-hidden />}
					{t.submit}
				</Button>
			</div>
			{error ? <p className="mt-3 text-destructive text-sm">{t.failed}</p> : null}
			{children}
		</form>
	);
}
