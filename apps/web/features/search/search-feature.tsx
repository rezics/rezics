"use client";

import { ContentLanguageValues } from "@rezics/i18n";
import {
	SearchCategoryValues,
	type ResolvedSearchControl,
	type SearchControlExpression,
	type SearchControlValue,
	type SearchFeatureDefinition,
	type SearchFeatureState,
	type SearchField,
	type SearchInjection,
	type SearchOperator,
	type SearchScalar,
	type SharedSearchQuerySelection,
	type SharedSearchQueryState,
} from "@rezics/search";
import { Badge, Button, ChoiceSelect, Field, FieldLabel, Input } from "@rezics/ui";
import { Filter, Search, Share2, X } from "lucide-react";
import { type FormEvent, type ReactNode, useMemo, useState } from "react";

import { useTranslation } from "@/i18n/client";
import { AdvancedSearchBuilder } from "./advanced-search-builder";
import { SearchEntityMultiSelect, type SearchEntityOption } from "./search-entity-multi-select";

export interface SearchFeatureFacet {
	readonly controlKey?: string;
	readonly field: string;
	readonly options: readonly { readonly value: string }[];
}

export interface SearchFeatureRequest {
	readonly injections: SearchInjection[];
	readonly state: SearchFeatureState;
}

export interface SearchFeatureShareRequest {
	readonly state: SharedSearchQueryState;
	readonly selections: readonly SharedSearchQuerySelection[];
}

function expressionFromClauses(
	clauses: readonly SearchControlExpression[],
): SearchControlExpression | undefined {
	return clauses.length === 0
		? undefined
		: clauses.length === 1
			? clauses[0]
			: { operator: "all", clauses: [...clauses] };
}

function expressionClauses(
	expression: SearchControlExpression | undefined,
): readonly SearchControlExpression[] {
	return expression && !("controlKey" in expression) && expression.operator === "all"
		? expression.clauses
		: expression
			? [expression]
			: [];
}

function classifyInitialState(state: SharedSearchQueryState | undefined): {
	readonly quick: readonly SearchControlValue[];
	readonly advanced?: SearchControlExpression;
} {
	if (!state) return { quick: [] };
	if (state.mode === "basic") return { quick: state.values };
	const quick: SearchControlValue[] = [];
	const advanced: SearchControlExpression[] = [];
	for (const clause of expressionClauses(state.expression)) {
		if (!("controlKey" in clause)) {
			advanced.push(clause);
			continue;
		}
		const { filter } = clause;
		const isQuick =
			(filter.field === "category" || filter.field === "language") &&
			["equals", "any-of"].includes(filter.operator);
		const isQuickTag =
			filter.field === "tag" &&
			["equals", "not-equals", "any-of", "none-of"].includes(filter.operator);
		if (isQuick || isQuickTag) quick.push(clause);
		else advanced.push(clause);
	}
	return { quick, advanced: expressionFromClauses(advanced) };
}

function valuesOf(value: SearchControlValue | undefined): readonly SearchScalar[] {
	if (!value) return [];
	const { filter } = value;
	if ("values" in filter) return filter.values;
	if ("value" in filter) return [filter.value];
	return [];
}

function selectionKey(field: SearchField, value: string): string {
	return `${field}\u0000${value}`;
}

function expressionContainsSelection(
	expression: SearchControlExpression | undefined,
	selection: SharedSearchQuerySelection,
): boolean {
	if (!expression) return false;
	if ("controlKey" in expression) {
		if (expression.filter.field !== selection.field) return false;
		const values =
			"values" in expression.filter
				? expression.filter.values
				: "value" in expression.filter
					? [expression.filter.value]
					: [expression.filter.lower, expression.filter.upper];
		return values.some((value) => value === selection.value);
	}
	return expression.operator === "not"
		? expressionContainsSelection(expression.clause, selection)
		: expression.clauses.some((clause) => expressionContainsSelection(clause, selection));
}

function stateContainsSelection(
	state: SharedSearchQueryState,
	selection: SharedSearchQuerySelection,
): boolean {
	return state.mode === "advanced"
		? expressionContainsSelection(state.expression, selection)
		: state.values.some((value) => expressionContainsSelection(value, selection));
}

function summarizeExpression(
	expression: SearchControlExpression,
	controls: readonly ResolvedSearchControl[],
	label: (control: ResolvedSearchControl) => string,
	valueLabel: (control: ResolvedSearchControl, value: SearchScalar) => string,
	operatorLabel: (operator: SearchOperator) => string,
	matchAll: string,
	matchAny: string,
): string {
	if ("controlKey" in expression) {
		const control = controls.find((candidate) => candidate.key === expression.controlKey);
		if (!control) return expression.controlKey;
		const filter = expression.filter;
		const values =
			"values" in filter
				? filter.values
				: "value" in filter
					? [filter.value]
					: [filter.lower, filter.upper].filter(
							(value): value is SearchScalar => value !== undefined,
						);
		return `${label(control)} · ${operatorLabel(filter.operator)}${
			values.length
				? ` · ${values.map((value) => valueLabel(control, value)).join(", ")}`
				: ""
		}`;
	}
	if (expression.operator === "not")
		return (
			operatorLabel("not-equals") +
			" " +
			summarizeExpression(
				expression.clause,
				controls,
				label,
				valueLabel,
				operatorLabel,
				matchAll,
				matchAny,
			)
		);
	return expression.clauses
		.map((clause) =>
			summarizeExpression(
				clause,
				controls,
				label,
				valueLabel,
				operatorLabel,
				matchAll,
				matchAny,
			),
		)
		.join(expression.operator === "all" ? ` · ${matchAll} · ` : ` · ${matchAny} · `);
}

export function SearchFeature({
	id,
	definition,
	initialQuery,
	initialState,
	initialSelections = [],
	injections = [],
	onInjectionsChange,
	onExecute,
	onShare,
	pending,
	error,
	facets,
	children,
	resolveLabel,
	resolveOptionLabel,
}: {
	readonly id: string;
	readonly definition: SearchFeatureDefinition;
	readonly initialQuery?: string;
	readonly initialState?: SharedSearchQueryState;
	readonly initialSelections?: readonly SharedSearchQuerySelection[];
	readonly injections?: readonly SearchInjection[];
	readonly onInjectionsChange?: (injections: readonly SearchInjection[]) => void;
	readonly onExecute: (request: SearchFeatureRequest) => void;
	readonly onShare?: (request: SearchFeatureShareRequest) => Promise<void>;
	readonly pending: boolean;
	readonly error: boolean;
	readonly facets?: readonly SearchFeatureFacet[];
	readonly children?: ReactNode;
	readonly resolveLabel?: (labelUnitId: string) => string | undefined;
	readonly resolveOptionLabel?: (
		control: ResolvedSearchControl,
		value: SearchScalar,
	) => string | undefined;
}) {
	const { t } = useTranslation("search");
	const { t: nav } = useTranslation("nav");
	const { t: units } = useTranslation("units");
	const { document, controls } = definition;
	const initial = useMemo(() => classifyInitialState(initialState), [initialState]);
	const initialSelectionByValue = useMemo(
		() =>
			new Map(
				initialSelections.map((selection) => [
					selectionKey(selection.field, selection.value),
					selection,
				]),
			),
		[initialSelections],
	);
	const [query, setQuery] = useState(
		initialState?.query ?? initialQuery ?? document.query.initial ?? "",
	);
	const [category, setCategory] = useState(() =>
		valuesOf(initial.quick.find((value) => value.filter.field === "category")).flatMap(
			(value) => (typeof value === "string" ? [value] : []),
		),
	);
	const [language, setLanguage] = useState(() =>
		valuesOf(initial.quick.find((value) => value.filter.field === "language")).flatMap(
			(value) => (typeof value === "string" ? [value] : []),
		),
	);
	const initialTagValues = (excluded: boolean) =>
		valuesOf(
			initial.quick.find(
				(value) =>
					value.filter.field === "tag" &&
					(excluded
						? ["not-equals", "none-of"].includes(value.filter.operator)
						: ["equals", "any-of"].includes(value.filter.operator)),
			),
		).flatMap((value): SearchEntityOption[] => {
			if (typeof value !== "string") return [];
			const presentation = initialSelectionByValue.get(selectionKey("tag", value));
			return [
				{
					id: value,
					label: presentation?.title ?? value,
					kind: presentation?.kind ?? t.fields.tag,
				},
			];
		});
	const [includedTags, setIncludedTags] = useState<readonly SearchEntityOption[]>(() =>
		initialTagValues(false),
	);
	const [excludedTags, setExcludedTags] = useState<readonly SearchEntityOption[]>(() =>
		initialTagValues(true),
	);
	const [advanced, setAdvanced] = useState<SearchControlExpression | undefined>(initial.advanced);
	const [advancedSelections, setAdvancedSelections] =
		useState<readonly SharedSearchQuerySelection[]>(initialSelections);
	const [builderOpen, setBuilderOpen] = useState(false);
	const [shareState, setShareState] = useState<"idle" | "copied" | "failed">("idle");

	const controlByField = (field: SearchField) =>
		controls.find((control) => control.field === field && control.modes.includes("advanced"));
	const categoryControl = controlByField("category");
	const languageControl = controlByField("language");
	const tagControl = controlByField("tag");
	const operatorLabels: Record<SearchOperator, string> = {
		equals: t.operators.equals,
		"not-equals": t.operators.notEquals,
		"any-of": t.operators.anyOf,
		"all-of": t.operators.allOf,
		"none-of": t.operators.noneOf,
		range: t.operators.range,
		exists: t.operators.exists,
	};
	const controlLabel = (control: ResolvedSearchControl) =>
		(control.labelUnitId ? resolveLabel?.(control.labelUnitId) : undefined) ??
		t.fields[control.field];
	const selectionCandidates = [
		...advancedSelections,
		...includedTags.map(
			(option) =>
				({
					field: "tag",
					value: option.id,
					title: option.label,
					kind: option.kind,
				}) satisfies SharedSearchQuerySelection,
		),
		...excludedTags.map(
			(option) =>
				({
					field: "tag",
					value: option.id,
					title: option.label,
					kind: option.kind,
				}) satisfies SharedSearchQuerySelection,
		),
	];
	const allSelections = [
		...new Map(
			selectionCandidates.map((selection) => [
				selectionKey(selection.field, selection.value),
				selection,
			]),
		).values(),
	];
	const selectionLabels = new Map(
		allSelections.map((selection) => [
			selectionKey(selection.field, selection.value),
			selection.title,
		]),
	);
	const localizedValues: Readonly<Record<string, string>> = {
		...nav.following.types,
		...units.rating,
		...units.aiDisclosure,
	};
	const valueLabel = (control: ResolvedSearchControl, value: SearchScalar) =>
		(typeof value === "string"
			? selectionLabels.get(selectionKey(control.field, value))
			: undefined) ??
		resolveOptionLabel?.(control, value) ??
		(typeof value === "boolean"
			? value
				? t.boolean.yes
				: t.boolean.no
			: (localizedValues[String(value)] ?? String(value)));

	function currentState(
		nextAdvanced: SearchControlExpression | undefined,
	): SharedSearchQueryState {
		const clauses: SearchControlExpression[] = [];
		if (categoryControl && category.length)
			clauses.push({
				controlKey: categoryControl.key,
				filter: { field: "category", operator: "any-of", values: [...category] },
			});
		if (languageControl && language.length)
			clauses.push({
				controlKey: languageControl.key,
				filter: { field: "language", operator: "any-of", values: [...language] },
			});
		if (tagControl && includedTags.length)
			clauses.push({
				controlKey: tagControl.key,
				filter: {
					field: "tag",
					operator: "any-of",
					values: includedTags.map((option) => option.id),
				},
			});
		if (tagControl && excludedTags.length)
			clauses.push({
				controlKey: tagControl.key,
				filter: {
					field: "tag",
					operator: "none-of",
					values: excludedTags.map((option) => option.id),
				},
			});
		if (nextAdvanced) clauses.push(nextAdvanced);
		return {
			mode: "advanced",
			query,
			expression: expressionFromClauses(clauses),
		};
	}

	function execute(nextAdvanced: SearchControlExpression | undefined) {
		onExecute({ injections: [...injections], state: currentState(nextAdvanced) });
	}

	function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		execute(advanced);
	}

	const advancedSummary = advanced
		? summarizeExpression(
				advanced,
				controls,
				controlLabel,
				valueLabel,
				(operator) => operatorLabels[operator],
				t.advancedCombinations.all,
				t.advancedCombinations.any,
			)
		: "";

	return (
		<>
			<form className="grid gap-5" onSubmit={submit}>
				{injections.length ? (
					<div aria-label={t.appliedContext} className="flex flex-wrap gap-2">
						{injections.map((injection, index) => {
							const control = controls.find(
								(candidate) => candidate.key === injection.value.controlKey,
							);
							return (
								<Badge
									key={`${injection.source}:${injection.value.controlKey}:${index}`}
									variant="secondary"
								>
									{t.injectionSources[injection.source]}:{" "}
									{valuesOf(injection.value)
										.map((value) =>
											control ? valueLabel(control, value) : String(value),
										)
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
							);
						})}
					</div>
				) : null}

				{document.query.enabled ? (
					<div className="flex items-stretch gap-2">
						<div className="relative min-w-0 flex-1">
							<Search
								aria-hidden
								className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
							/>
							<Input
								aria-label={t.query}
								className="h-12 ps-10 text-base"
								id={`${id}-query`}
								maxLength={500}
								onChange={(event) => setQuery(event.currentTarget.value)}
								placeholder={t.placeholder}
								required={document.query.required}
								type="search"
								value={query}
							/>
						</div>
						<Button
							className="h-12 shrink-0 px-5"
							isLoading={pending}
							type="submit"
							variant="solid"
						>
							<Search aria-hidden />
							<span className="max-sm:sr-only">{t.submit}</span>
						</Button>
					</div>
				) : null}

				<div aria-label={t.commonFilters} className="grid gap-4 lg:grid-cols-12">
					{categoryControl ? (
						<Field className="lg:col-span-3">
							<FieldLabel>{t.contentCategory}</FieldLabel>
							<ChoiceSelect
								appearance="field"
								ariaLabel={t.contentCategory}
								multiple
								onValueChange={(values) => setCategory([...values])}
								options={SearchCategoryValues.map((value) => ({
									value,
									label: t.categoryOptions[value],
								}))}
								placeholder={t.allCategories}
								value={category}
							/>
						</Field>
					) : null}
					{tagControl ? (
						<div className="grid gap-3 sm:grid-cols-2 lg:col-span-6">
							<Field>
								<FieldLabel>{t.includeTags}</FieldLabel>
								<SearchEntityMultiSelect
									emptyLabel={t.entitySearchEmpty}
									errorLabel={t.entitySearchError}
									index="tags"
									loadingLabel={t.entitySearchLoading}
									onChange={setIncludedTags}
									placeholder={t.tagSearchPlaceholder}
									removeLabel={t.removeSelection}
									selected={includedTags}
								/>
							</Field>
							<Field>
								<FieldLabel>{t.excludeTags}</FieldLabel>
								<SearchEntityMultiSelect
									emptyLabel={t.entitySearchEmpty}
									errorLabel={t.entitySearchError}
									index="tags"
									loadingLabel={t.entitySearchLoading}
									onChange={setExcludedTags}
									placeholder={t.tagSearchPlaceholder}
									removeLabel={t.removeSelection}
									selected={excludedTags}
								/>
							</Field>
						</div>
					) : null}
					{languageControl ? (
						<Field className="lg:col-span-3">
							<FieldLabel>{t.language}</FieldLabel>
							<ChoiceSelect
								appearance="field"
								ariaLabel={t.language}
								multiple
								onValueChange={(values) => setLanguage([...values])}
								options={ContentLanguageValues.map((value) => ({
									value,
									label: t.languageOptions[value],
								}))}
								placeholder={t.allLanguages}
								value={language}
							/>
						</Field>
					) : null}
				</div>

				<div className="flex flex-wrap items-center justify-between gap-3">
					<Button
						onClick={() => setBuilderOpen(true)}
						size="sm"
						type="button"
						variant="quiet"
					>
						<Filter aria-hidden />
						{t.advancedFilters}
					</Button>
					{onShare ? (
						<Button
							onClick={() => {
								setShareState("idle");
								const state = currentState(advanced);
								void onShare({
									state,
									selections: allSelections.filter((selection) =>
										stateContainsSelection(state, selection),
									),
								}).then(
									() => setShareState("copied"),
									() => setShareState("failed"),
								);
							}}
							size="sm"
							type="button"
							variant="quiet"
						>
							<Share2 aria-hidden />
							{shareState === "copied" ? t.shareCopied : t.shareQuery}
						</Button>
					) : null}
				</div>

				{shareState === "failed" ? (
					<p className="text-destructive text-sm" role="alert">
						{t.shareFailed}
					</p>
				) : null}

				{advanced ? (
					<section className="flex flex-wrap items-center gap-2 rounded-lg bg-muted/50 px-3 py-3">
						<span className="font-medium text-sm">{t.appliedAdvancedFilters}</span>
						<Badge
							className="max-w-full whitespace-normal text-start leading-5"
							variant="secondary"
						>
							{advancedSummary}
						</Badge>
						<Button
							className="ms-auto"
							onClick={() => setBuilderOpen(true)}
							size="sm"
							type="button"
							variant="quiet"
						>
							{t.editAdvancedFilters}
						</Button>
						<Button
							onClick={() => {
								setAdvanced(undefined);
								setAdvancedSelections([]);
								execute(undefined);
							}}
							size="sm"
							type="button"
							variant="quiet"
						>
							{t.clearAdvancedFilters}
						</Button>
					</section>
				) : null}
			</form>

			{error ? <p className="sr-only">{t.failed}</p> : null}
			{children}

			<AdvancedSearchBuilder
				controls={controls}
				expression={advanced}
				facets={facets}
				onApply={(nextExpression, nextSelections) => {
					setAdvanced(nextExpression);
					setAdvancedSelections(nextSelections);
					execute(nextExpression);
				}}
				onOpenChange={setBuilderOpen}
				open={builderOpen}
				resolveLabel={resolveLabel}
				resolveOptionLabel={valueLabel}
				selections={advancedSelections}
			/>
		</>
	);
}
