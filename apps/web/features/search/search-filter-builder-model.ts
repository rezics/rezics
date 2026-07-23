import type { PresentedAvatar } from "@rezics/avatar";
import type {
	ResolvedSearchControl,
	SearchControlExpression,
	SearchFilter,
	SearchOperator,
	SearchScalar,
	SharedSearchQuerySelection,
} from "@rezics/search";

export interface DraftSearchValue {
	readonly value: SearchScalar;
	readonly label: string;
	readonly kind?: string;
	readonly avatar?: PresentedAvatar | null;
}

export interface DraftSearchCondition {
	readonly id: string;
	readonly kind: "condition";
	readonly controlKey: string;
	readonly operator: SearchOperator;
	readonly values: readonly DraftSearchValue[];
	readonly lower?: SearchScalar;
	readonly upper?: SearchScalar;
}

export interface DraftSearchGroup {
	readonly id: string;
	readonly kind: "group";
	readonly operator: "all" | "any";
	readonly clauses: readonly DraftSearchNode[];
}

export type DraftSearchNode = DraftSearchCondition | DraftSearchGroup;

let nextDraftId = 0;
export function createDraftId(): string {
	nextDraftId += 1;
	return `search-draft-${nextDraftId}`;
}

function valuesOf(filter: SearchFilter): readonly SearchScalar[] {
	if ("values" in filter) return filter.values;
	if ("value" in filter) return [filter.value];
	return [];
}

function defaultOperator(control: ResolvedSearchControl): SearchOperator {
	if (control.component === "multi-select" && control.operators.includes("any-of"))
		return "any-of";
	return control.operators[0] ?? "equals";
}

export function createDraftCondition(
	controls: readonly ResolvedSearchControl[],
): DraftSearchCondition | undefined {
	const control = controls[0];
	return control
		? {
				id: createDraftId(),
				kind: "condition",
				controlKey: control.key,
				operator: defaultOperator(control),
				values: [],
			}
		: undefined;
}

function presentationKey(field: string, value: SearchScalar): string {
	return `${field}\u0000${JSON.stringify(value)}`;
}

export function draftFromExpression(
	expression: SearchControlExpression | undefined,
	selections: readonly SharedSearchQuerySelection[] = [],
): DraftSearchGroup {
	const presentation = new Map(
		selections.map((selection) => [
			presentationKey(selection.field, selection.value),
			selection,
		]),
	);
	function convert(node: SearchControlExpression): DraftSearchNode {
		if ("controlKey" in node) {
			const values = valuesOf(node.filter).map((value): DraftSearchValue => {
				const selected = presentation.get(presentationKey(node.filter.field, value));
				return {
					value,
					label: selected?.title ?? String(value),
					...(selected?.kind ? { kind: selected.kind } : {}),
				};
			});
			return {
				id: createDraftId(),
				kind: "condition",
				controlKey: node.controlKey,
				operator: node.filter.operator,
				values,
				...("lower" in node.filter && node.filter.lower !== undefined
					? { lower: node.filter.lower }
					: {}),
				...("upper" in node.filter && node.filter.upper !== undefined
					? { upper: node.filter.upper }
					: {}),
			};
		}
		if (node.operator === "not") {
			const converted = convert(node.clause);
			if (converted.kind === "condition") {
				const inverse: Partial<Record<SearchOperator, SearchOperator>> = {
					equals: "not-equals",
					"not-equals": "equals",
					"any-of": "none-of",
					"none-of": "any-of",
				};
				const operator = inverse[converted.operator];
				if (operator) return { ...converted, operator };
			}
			return {
				id: createDraftId(),
				kind: "group",
				operator: "all",
				clauses: [converted],
			};
		}
		return {
			id: createDraftId(),
			kind: "group",
			operator: node.operator,
			clauses: node.clauses.map(convert),
		};
	}
	const converted = expression ? convert(expression) : undefined;
	if (!converted) return { id: createDraftId(), kind: "group", operator: "all", clauses: [] };
	return converted.kind === "group"
		? converted
		: {
				id: createDraftId(),
				kind: "group",
				operator: "all",
				clauses: [converted],
			};
}

export type CompileDraftResult =
	| { readonly ok: true; readonly expression?: SearchControlExpression }
	| { readonly ok: false; readonly invalidIds: ReadonlySet<string> };

export function compileDraftSearch(
	root: DraftSearchGroup,
	controls: readonly ResolvedSearchControl[],
): CompileDraftResult {
	const byKey = new Map(controls.map((control) => [control.key, control]));
	const invalidIds = new Set<string>();

	function compile(node: DraftSearchNode): SearchControlExpression | undefined {
		if (node.kind === "group") {
			const clauses = node.clauses.flatMap((clause) => {
				const compiled = compile(clause);
				return compiled ? [compiled] : [];
			});
			if (!clauses.length) {
				if (node !== root) invalidIds.add(node.id);
				return undefined;
			}
			return clauses.length === 1 ? clauses[0] : { operator: node.operator, clauses };
		}
		const control = byKey.get(node.controlKey);
		if (!control || !control.operators.includes(node.operator)) {
			invalidIds.add(node.id);
			return undefined;
		}
		const values = node.values.map((value) => value.value);
		let filter: SearchFilter | undefined;
		if (node.operator === "range") {
			if (node.lower !== undefined)
				filter =
					node.upper === undefined
						? { field: control.field, operator: "range", lower: node.lower }
						: {
								field: control.field,
								operator: "range",
								lower: node.lower,
								upper: node.upper,
							};
			else if (node.upper !== undefined)
				filter = { field: control.field, operator: "range", upper: node.upper };
		} else if (node.operator === "exists") {
			const value = values[0];
			if (typeof value === "boolean")
				filter = { field: control.field, operator: "exists", value };
		} else if (node.operator === "equals" || node.operator === "not-equals") {
			const value = values[0];
			if (value !== undefined)
				filter = { field: control.field, operator: node.operator, value };
		} else if (values.length) {
			filter = { field: control.field, operator: node.operator, values };
		}
		if (!filter) {
			invalidIds.add(node.id);
			return undefined;
		}
		return { controlKey: control.key, filter };
	}

	const expression = compile(root);
	return invalidIds.size ? { ok: false, invalidIds } : { ok: true, expression };
}

export function replaceDraftNode(
	root: DraftSearchGroup,
	id: string,
	replacement: DraftSearchNode,
): DraftSearchGroup {
	if (root.id === id) return replacement.kind === "group" ? replacement : root;
	function visit(node: DraftSearchNode): DraftSearchNode {
		if (node.id === id) return replacement;
		return node.kind === "group" ? { ...node, clauses: node.clauses.map(visit) } : node;
	}
	return { ...root, clauses: root.clauses.map(visit) };
}

export function removeDraftNode(root: DraftSearchGroup, id: string): DraftSearchGroup {
	function visit(group: DraftSearchGroup): DraftSearchGroup {
		return {
			...group,
			clauses: group.clauses
				.filter((clause) => clause.id !== id)
				.map((clause) => (clause.kind === "group" ? visit(clause) : clause)),
		};
	}
	return visit(root);
}

export function sharedSelectionsFromDraft(
	root: DraftSearchGroup,
	controls: readonly ResolvedSearchControl[],
): SharedSearchQuerySelection[] {
	const byKey = new Map(controls.map((control) => [control.key, control]));
	const byValue = new Map<string, SharedSearchQuerySelection>();
	function visit(node: DraftSearchNode): void {
		if (node.kind === "group") {
			node.clauses.forEach(visit);
			return;
		}
		const control = byKey.get(node.controlKey);
		if (!control) return;
		for (const selected of node.values) {
			if (typeof selected.value !== "string" || !selected.kind) continue;
			const selection = {
				field: control.field,
				value: selected.value,
				title: selected.label,
				kind: selected.kind,
			} satisfies SharedSearchQuerySelection;
			byValue.set(presentationKey(selection.field, selection.value), selection);
		}
	}
	visit(root);
	return [...byValue.values()];
}
