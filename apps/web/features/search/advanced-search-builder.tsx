"use client";

import type {
	ResolvedSearchControl,
	SearchControlExpression,
	SearchField,
	SearchOperator,
	SearchScalar,
	SharedSearchQuerySelection,
} from "@rezics/filter";
import {
	Button,
	ChoiceSelect,
	Dialog,
	DialogBody,
	DialogContent,
	DialogFooter,
	DialogHeader,
	Field,
	FieldLabel,
	Input,
} from "@rezics/ui";
import { Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

import { useTranslation } from "@/i18n/client";
import {
	compileDraftSearch,
	createDraftCondition,
	createDraftId,
	draftFromExpression,
	removeDraftNode,
	replaceDraftNode,
	sharedSelectionsFromDraft,
	type DraftSearchCondition,
	type DraftSearchGroup,
	type DraftSearchNode,
	type DraftSearchValue,
} from "./search-filter-builder-model";
import { SearchEntityMultiSelect, type SearchEntityOption } from "./search-entity-multi-select";
import type { SearchFeatureFacet } from "./search-feature";

const EntityFieldIndex: Partial<Record<SearchField, string>> = {
	tag: "tags",
	credit: "all",
	realm: "realms",
	zone: "realms",
	subject: "all",
	target: "all",
	root: "all",
	parent: "all",
	owner: "users",
	"software-platform": "entity",
};

function selectedScalars(condition: DraftSearchCondition): readonly SearchScalar[] {
	return condition.values.map((value) => value.value);
}

/**
 * Frontend-only editor for composing the unified SearchControlExpression.
 *
 * "Advanced" describes the richer UI (nested Boolean groups and operators);
 * it does not select a backend mode, widen server capabilities, or alter
 * execution semantics.
 */
export function AdvancedSearchBuilder({
	open,
	onOpenChange,
	controls,
	expression,
	selections,
	facets,
	resolveLabel,
	resolveOptionLabel,
	onApply,
}: {
	readonly open: boolean;
	readonly onOpenChange: (open: boolean) => void;
	readonly controls: readonly ResolvedSearchControl[];
	readonly expression?: SearchControlExpression;
	readonly selections?: readonly SharedSearchQuerySelection[];
	readonly facets?: readonly SearchFeatureFacet[];
	readonly resolveLabel?: (labelUnitId: string) => string | undefined;
	readonly resolveOptionLabel?: (
		control: ResolvedSearchControl,
		value: SearchScalar,
	) => string | undefined;
	readonly onApply: (
		expression: SearchControlExpression | undefined,
		selections: readonly SharedSearchQuerySelection[],
	) => void;
}) {
	const { t } = useTranslation("search");
	const advancedControls = controls;
	const [root, setRoot] = useState<DraftSearchGroup>(() =>
		draftFromExpression(expression, selections),
	);
	const [attempted, setAttempted] = useState(false);

	useEffect(() => {
		if (!open) return;
		setRoot(draftFromExpression(expression, selections));
		setAttempted(false);
	}, [expression, open, selections]);

	const compiled = compileDraftSearch(root, advancedControls);
	const operatorLabels: Record<SearchOperator, string> = {
		equals: t.operators.equals,
		"not-equals": t.operators.notEquals,
		"any-of": t.operators.anyOf,
		"all-of": t.operators.allOf,
		"none-of": t.operators.noneOf,
		range: t.operators.range,
		exists: t.operators.exists,
		matches: t.operators.matches,
	};
	const controlLabel = (control: ResolvedSearchControl) =>
		(control.labelUnitId ? resolveLabel?.(control.labelUnitId) : undefined) ??
		t.fields[control.field];
	const valueLabel = (control: ResolvedSearchControl, value: SearchScalar) =>
		resolveOptionLabel?.(control, value) ??
		(typeof value === "boolean" ? (value ? t.boolean.yes : t.boolean.no) : String(value));

	function summary(node: DraftSearchNode): string {
		if (node.kind === "group") {
			const children = node.clauses.map(summary).filter(Boolean);
			if (!children.length) return "";
			return `(${children.join(
				node.operator === "all"
					? ` ${t.advancedCombinations.all} `
					: ` ${t.advancedCombinations.any} `,
			)})`;
		}
		const control = advancedControls.find((candidate) => candidate.key === node.controlKey);
		if (!control) return "";
		if (control.field === "realm-tag-vote") {
			const relation = node.realmTagVote;
			const bounds = [
				relation?.scoreLower === undefined
					? undefined
					: `${t.realmTagVote.score} ≥ ${relation.scoreLower}`,
				relation?.scoreUpper === undefined
					? undefined
					: `${t.realmTagVote.score} ≤ ${relation.scoreUpper}`,
				relation?.voteCountLower === undefined
					? undefined
					: `${t.realmTagVote.voteCount} ≥ ${relation.voteCountLower}`,
				relation?.voteCountUpper === undefined
					? undefined
					: `${t.realmTagVote.voteCount} ≤ ${relation.voteCountUpper}`,
			].filter((value): value is string => value !== undefined);
			return [controlLabel(control), relation?.realm?.label, relation?.tag?.label, ...bounds]
				.filter(Boolean)
				.join(" · ");
		}
		const values =
			node.operator === "range"
				? [node.lower, node.upper]
						.filter((value): value is SearchScalar => value !== undefined)
						.map((value) => valueLabel(control, value))
						.join(" – ")
				: node.values.map((value) => valueLabel(control, value.value)).join(", ");
		return `${controlLabel(control)} · ${operatorLabels[node.operator]}${
			values ? ` · ${values}` : ""
		}`;
	}

	function updateCondition(condition: DraftSearchCondition) {
		setRoot((current) => replaceDraftNode(current, condition.id, condition));
	}

	function addCondition(group: DraftSearchGroup) {
		const condition = createDraftCondition(advancedControls);
		if (!condition) return;
		setRoot((current) =>
			replaceDraftNode(current, group.id, {
				...group,
				clauses: [...group.clauses, condition],
			}),
		);
	}

	function addGroup(group: DraftSearchGroup) {
		setRoot((current) =>
			replaceDraftNode(current, group.id, {
				...group,
				clauses: [
					...group.clauses,
					{
						id: createDraftId(),
						kind: "group",
						operator: "all",
						clauses: [],
					},
				],
			}),
		);
	}

	function valueEditor(condition: DraftSearchCondition, control: ResolvedSearchControl) {
		if (control.field === "realm-tag-vote") {
			const relation = condition.realmTagVote;
			const entityOption = (
				value: DraftSearchValue | undefined,
			): readonly SearchEntityOption[] =>
				value && typeof value.value === "string"
					? [
							{
								id: value.value,
								label: value.label,
								kind: value.kind ?? controlLabel(control),
								avatar: value.avatar,
							},
						]
					: [];
			const nextInteger = (value: string): number | undefined => {
				if (!value) return undefined;
				const parsed = Number(value);
				return Number.isSafeInteger(parsed) ? parsed : undefined;
			};
			const replaceRelation = (
				patch: Partial<NonNullable<DraftSearchCondition["realmTagVote"]>>,
			) =>
				updateCondition({
					...condition,
					realmTagVote: { ...relation, ...patch },
				});
			return (
				<div className="grid gap-3">
					<div className="grid gap-2 md:grid-cols-2">
						<div className="grid gap-1">
							<span className="font-medium text-xs">{t.realmTagVote.realm}</span>
							<SearchEntityMultiSelect
								emptyLabel={t.entitySearchEmpty}
								errorLabel={t.entitySearchError}
								index="realms"
								loadingLabel={t.entitySearchLoading}
								onChange={(next) => {
									const selected = next.at(-1);
									replaceRelation({
										realm: selected
											? {
													value: selected.id,
													label: selected.label,
													kind: selected.kind,
													avatar: selected.avatar,
												}
											: undefined,
									});
								}}
								placeholder={t.realmTagVote.realmPlaceholder}
								removeLabel={t.removeSelection}
								selected={entityOption(relation?.realm)}
							/>
						</div>
						<div className="grid gap-1">
							<span className="font-medium text-xs">{t.realmTagVote.tag}</span>
							<SearchEntityMultiSelect
								emptyLabel={t.entitySearchEmpty}
								errorLabel={t.entitySearchError}
								index="tags"
								loadingLabel={t.entitySearchLoading}
								onChange={(next) => {
									const selected = next.at(-1);
									replaceRelation({
										tag: selected
											? {
													value: selected.id,
													label: selected.label,
													kind: selected.kind,
													avatar: selected.avatar,
												}
											: undefined,
									});
								}}
								placeholder={t.realmTagVote.tagPlaceholder}
								removeLabel={t.removeSelection}
								selected={entityOption(relation?.tag)}
							/>
						</div>
					</div>
					<div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
						{(
							[
								["scoreLower", t.realmTagVote.scoreMinimum, relation?.scoreLower],
								["scoreUpper", t.realmTagVote.scoreMaximum, relation?.scoreUpper],
								[
									"voteCountLower",
									t.realmTagVote.voteCountMinimum,
									relation?.voteCountLower,
								],
								[
									"voteCountUpper",
									t.realmTagVote.voteCountMaximum,
									relation?.voteCountUpper,
								],
							] as const
						).map(([key, label, value]) => (
							<Input
								aria-label={label}
								key={key}
								min={key.startsWith("voteCount") ? 0 : undefined}
								onChange={(event) =>
									replaceRelation({
										[key]: nextInteger(event.currentTarget.value),
									})
								}
								placeholder={label}
								type="number"
								value={value ?? ""}
							/>
						))}
					</div>
					<p className="text-muted-foreground text-xs">{t.realmTagVote.boundsOptional}</p>
				</div>
			);
		}
		if (condition.operator === "range") {
			const inputType =
				control.component === "date-range"
					? "date"
					: control.component === "value-range"
						? "number"
						: "text";
			const read = (value: string): SearchScalar | undefined => {
				if (!value) return undefined;
				if (inputType !== "number") return value;
				const parsed = Number(value);
				return Number.isSafeInteger(parsed) ? parsed : undefined;
			};
			return (
				<div className="grid grid-cols-2 gap-2">
					<Input
						aria-label={`${controlLabel(control)} · ${t.rangeLower}`}
						onChange={(event) =>
							updateCondition({
								...condition,
								lower: read(event.currentTarget.value),
							})
						}
						placeholder={t.rangeLower}
						type={inputType}
						value={
							condition.lower === undefined || typeof condition.lower === "boolean"
								? ""
								: String(condition.lower)
						}
					/>
					<Input
						aria-label={`${controlLabel(control)} · ${t.rangeUpper}`}
						onChange={(event) =>
							updateCondition({
								...condition,
								upper: read(event.currentTarget.value),
							})
						}
						placeholder={t.rangeUpper}
						type={inputType}
						value={
							condition.upper === undefined || typeof condition.upper === "boolean"
								? ""
								: String(condition.upper)
						}
					/>
				</div>
			);
		}

		const entityIndex = EntityFieldIndex[control.field];
		if (entityIndex) {
			const selected: SearchEntityOption[] = condition.values.flatMap((value) =>
				typeof value.value === "string"
					? [
							{
								id: value.value,
								label: value.label,
								kind: value.kind ?? controlLabel(control),
								avatar: value.avatar,
							},
						]
					: [],
			);
			return (
				<SearchEntityMultiSelect
					emptyLabel={t.entitySearchEmpty}
					errorLabel={t.entitySearchError}
					index={entityIndex}
					loadingLabel={t.entitySearchLoading}
					onChange={(next) =>
						updateCondition({
							...condition,
							values: next.map((option): DraftSearchValue => ({
								value: option.id,
								label: option.label,
								kind: option.kind,
								avatar: option.avatar,
							})),
						})
					}
					placeholder={
						control.field === "tag" ? t.tagSearchPlaceholder : t.entitySearchPlaceholder
					}
					removeLabel={t.removeSelection}
					selected={selected}
				/>
			);
		}

		const facetValues =
			facets
				?.find(
					(facet) =>
						facet.controlKey === control.key ||
						(!facet.controlKey && facet.field === control.field),
				)
				?.options.map((option) => option.value) ?? [];
		const candidates =
			control.optionSource?.kind === "static"
				? control.optionSource.options.map((option) => option.value)
				: control.component === "toggle" || condition.operator === "exists"
					? [true, false]
					: facetValues;
		if (candidates.length) {
			const byKey = new Map(candidates.map((value) => [JSON.stringify(value), value]));
			const multiple = !["equals", "not-equals", "exists"].includes(condition.operator);
			return (
				<ChoiceSelect
					appearance="field"
					ariaLabel={`${controlLabel(control)} · ${t.builder.value}`}
					multiple={multiple}
					onValueChange={(keys) =>
						updateCondition({
							...condition,
							values: keys.flatMap((key) => {
								const value = byKey.get(key);
								return value === undefined
									? []
									: [{ value, label: valueLabel(control, value) }];
							}),
						})
					}
					options={candidates.map((value) => ({
						value: JSON.stringify(value),
						label: valueLabel(control, value),
					}))}
					placeholder={t.builder.value}
					value={selectedScalars(condition).map((value) => JSON.stringify(value))}
				/>
			);
		}

		const value = condition.values[0]?.value;
		return (
			<Input
				aria-label={`${controlLabel(control)} · ${t.builder.value}`}
				onChange={(event) => {
					const next = event.currentTarget.value;
					updateCondition({
						...condition,
						values: next ? [{ value: next, label: next }] : [],
					});
				}}
				placeholder={t.builder.value}
				value={typeof value === "string" || typeof value === "number" ? String(value) : ""}
			/>
		);
	}

	function conditionEditor(condition: DraftSearchCondition) {
		const control =
			advancedControls.find((candidate) => candidate.key === condition.controlKey) ??
			advancedControls[0];
		if (!control) return null;
		const invalid = attempted && !compiled.ok && compiled.invalidIds.has(condition.id);
		return (
			<div
				className="grid gap-2 border-b border-border-weak py-4 last:border-b-0 sm:grid-cols-[minmax(10rem,0.8fr)_minmax(9rem,0.65fr)_minmax(14rem,1.5fr)_auto]"
				key={condition.id}
			>
				<Field>
					<FieldLabel>{t.builder.condition}</FieldLabel>
					<ChoiceSelect
						appearance="field"
						ariaLabel={t.builder.condition}
						onValueChange={(keys) => {
							const next = advancedControls.find(
								(candidate) => candidate.key === keys[0],
							);
							if (!next) return;
							const replacement = createDraftCondition([next]);
							if (replacement) updateCondition({ ...replacement, id: condition.id });
						}}
						options={advancedControls.map((candidate) => ({
							value: candidate.key,
							label: controlLabel(candidate),
						}))}
						placeholder={t.builder.condition}
						value={[control.key]}
					/>
				</Field>
				<Field>
					<FieldLabel>{t.builder.operator}</FieldLabel>
					<ChoiceSelect
						appearance="field"
						ariaLabel={t.builder.operator}
						onValueChange={(keys) => {
							const operator = keys[0];
							if (
								!operator ||
								!control.operators.some((candidate) => candidate === operator)
							)
								return;
							updateCondition({
								...condition,
								operator,
								values: [],
								lower: undefined,
								upper: undefined,
								realmTagVote: undefined,
							});
						}}
						options={control.operators.map((operator) => ({
							value: operator,
							label: operatorLabels[operator],
						}))}
						placeholder={t.builder.operator}
						value={[condition.operator]}
					/>
				</Field>
				<Field invalid={invalid}>
					<FieldLabel>{t.builder.value}</FieldLabel>
					{valueEditor(condition, control)}
					{invalid ? (
						<p className="text-destructive text-xs" role="alert">
							{t.builder.incomplete}
						</p>
					) : null}
				</Field>
				<Button
					aria-label={t.builder.removeCondition}
					className="self-end"
					onClick={() => setRoot((current) => removeDraftNode(current, condition.id))}
					size="icon-md"
					type="button"
					variant="quiet"
				>
					<Trash2 aria-hidden />
				</Button>
			</div>
		);
	}

	function groupEditor(group: DraftSearchGroup, depth: number) {
		const invalid = attempted && !compiled.ok && compiled.invalidIds.has(group.id);
		return (
			<section
				className={
					depth === 0
						? "grid gap-3"
						: "grid gap-3 border-s-4 border-primary/70 bg-muted/24 py-3 ps-4 pe-3"
				}
				key={group.id}
			>
				<div className="flex flex-wrap items-center justify-between gap-2">
					<ChoiceSelect
						ariaLabel={t.builder.match}
						onValueChange={(values) => {
							const operator = values[0];
							if (operator !== "all" && operator !== "any") return;
							setRoot((current) =>
								replaceDraftNode(current, group.id, { ...group, operator }),
							);
						}}
						options={[
							{ value: "all", label: t.builder.matchAll },
							{ value: "any", label: t.builder.matchAny },
						]}
						placeholder={t.builder.match}
						value={[group.operator]}
					/>
					{depth > 0 ? (
						<Button
							aria-label={t.builder.removeCondition}
							onClick={() => setRoot((current) => removeDraftNode(current, group.id))}
							size="icon-sm"
							type="button"
							variant="quiet"
						>
							<Trash2 aria-hidden />
						</Button>
					) : null}
				</div>
				<div>
					{group.clauses.map((node) =>
						node.kind === "group"
							? groupEditor(node, depth + 1)
							: conditionEditor(node),
					)}
				</div>
				{invalid ? (
					<p className="text-destructive text-xs" role="alert">
						{t.builder.incomplete}
					</p>
				) : null}
				<div className="flex flex-wrap gap-2">
					<Button
						onClick={() => addCondition(group)}
						size="sm"
						type="button"
						variant="outline"
					>
						<Plus aria-hidden />
						{t.builder.addCondition}
					</Button>
					{depth < 1 ? (
						<Button
							onClick={() => addGroup(group)}
							size="sm"
							type="button"
							variant="outline"
						>
							<Plus aria-hidden />
							{t.builder.addGroup}
						</Button>
					) : null}
				</div>
			</section>
		);
	}

	const summaryText = summary(root);
	return (
		<Dialog onOpenChange={({ open: nextOpen }) => onOpenChange(nextOpen)} open={open}>
			<DialogContent
				bottomStickOnMobile={false}
				className="max-sm:fixed max-sm:inset-0 max-sm:size-full max-sm:max-h-svh max-sm:rounded-none max-sm:border-0"
				showCloseButton={false}
				size="5xl"
			>
				<DialogHeader description={t.builder.description} title={t.builder.title} />
				<DialogBody className="grid gap-6">
					{groupEditor(root, 0)}
					<section className="grid gap-2 border-t border-border-weak pt-4">
						<h3 className="font-semibold text-sm">{t.builder.querySummary}</h3>
						<p className="text-muted-foreground text-sm leading-6">
							{summaryText || t.builder.emptySummary}
						</p>
					</section>
				</DialogBody>
				<DialogFooter className="border-t">
					<Button onClick={() => onOpenChange(false)} type="button" variant="outline">
						{t.builder.cancel}
					</Button>
					<Button
						onClick={() => {
							setAttempted(true);
							if (!compiled.ok) return;
							onApply(
								compiled.expression,
								sharedSelectionsFromDraft(root, advancedControls),
							);
							onOpenChange(false);
						}}
						type="button"
						variant="solid"
					>
						{t.builder.apply}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
