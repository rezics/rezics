import type { PresentedAvatar } from "@rezics/avatar";
import type {
	ResolvedSearchControl,
	SearchControlExpression,
	SearchControlPredicate,
	SearchOperator,
	SearchScalar,
	SharedSearchQuerySelection,
} from "@rezics/filter";

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
	readonly realmTagVote?: {
		readonly realm?: DraftSearchValue;
		readonly tag?: DraftSearchValue;
		readonly scoreLower?: number;
		readonly scoreUpper?: number;
		readonly voteCountLower?: number;
		readonly voteCountUpper?: number;
	};
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

function valuesOf(filter: SearchControlPredicate): readonly SearchScalar[] {
	if (filter.field === "realm-tag-vote") return [];
	if ("values" in filter) return filter.values;
	if ("value" in filter) return [filter.value];
	return [];
}

function defaultOperator(control: ResolvedSearchControl): SearchOperator {
	if (control.component === "multi-select" && control.operators.includes("any-of"))
		return "any-of";
	return control.operators[0] ?? "equals";
}

function numericRange(lower: number | undefined, upper: number | undefined) {
	if (lower !== undefined) return upper === undefined ? { lower } : { lower, upper };
	return upper === undefined ? undefined : { upper };
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
			if (node.filter.field === "realm-tag-vote") {
				const realm = presentation.get(presentationKey("realm", node.filter.realmId));
				const tag = presentation.get(presentationKey("tag", node.filter.tagId));
				return {
					id: createDraftId(),
					kind: "condition",
					controlKey: node.controlKey,
					operator: "matches",
					values: [],
					realmTagVote: {
						realm: {
							value: node.filter.realmId,
							label: realm?.title ?? node.filter.realmId,
							...(realm?.kind ? { kind: realm.kind } : {}),
						},
						tag: {
							value: node.filter.tagId,
							label: tag?.title ?? node.filter.tagId,
							...(tag?.kind ? { kind: tag.kind } : {}),
						},
						...(node.filter.score?.lower === undefined
							? {}
							: { scoreLower: node.filter.score.lower }),
						...(node.filter.score?.upper === undefined
							? {}
							: { scoreUpper: node.filter.score.upper }),
						...(node.filter.voteCount?.lower === undefined
							? {}
							: { voteCountLower: node.filter.voteCount.lower }),
						...(node.filter.voteCount?.upper === undefined
							? {}
							: { voteCountUpper: node.filter.voteCount.upper }),
					},
				};
			}
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
		let filter: SearchControlPredicate | undefined;
		const field = control.field;
		if (field === "realm-tag-vote" && node.operator === "matches") {
			const realmId = node.realmTagVote?.realm?.value;
			const tagId = node.realmTagVote?.tag?.value;
			const { scoreLower, scoreUpper, voteCountLower, voteCountUpper } =
				node.realmTagVote ?? {};
			const boundsValid =
				(scoreLower === undefined ||
					scoreUpper === undefined ||
					scoreLower <= scoreUpper) &&
				(voteCountLower === undefined ||
					voteCountUpper === undefined ||
					voteCountLower <= voteCountUpper) &&
				(voteCountLower === undefined || voteCountLower >= 0) &&
				(voteCountUpper === undefined || voteCountUpper >= 0);
			const score = numericRange(scoreLower, scoreUpper);
			const voteCount = numericRange(voteCountLower, voteCountUpper);
			if (typeof realmId === "string" && typeof tagId === "string" && boundsValid)
				filter = {
					field: "realm-tag-vote",
					operator: "matches",
					realmId,
					tagId,
					...(score ? { score } : {}),
					...(voteCount ? { voteCount } : {}),
				};
		} else if (field !== "realm-tag-vote" && node.operator === "range") {
			if (node.lower !== undefined)
				filter =
					node.upper === undefined
						? { field, operator: "range", lower: node.lower }
						: {
								field,
								operator: "range",
								lower: node.lower,
								upper: node.upper,
							};
			else if (node.upper !== undefined)
				filter = { field, operator: "range", upper: node.upper };
		} else if (field !== "realm-tag-vote" && node.operator === "exists") {
			const value = values[0];
			if (typeof value === "boolean") filter = { field, operator: "exists", value };
		} else if (field !== "realm-tag-vote" && node.operator === "equals") {
			const value = values[0];
			if (value !== undefined) filter = { field, operator: "equals", value };
		} else if (field !== "realm-tag-vote" && node.operator === "not-equals") {
			const value = values[0];
			if (value !== undefined) filter = { field, operator: "not-equals", value };
		} else if (
			field !== "realm-tag-vote" &&
			(node.operator === "any-of" ||
				node.operator === "all-of" ||
				node.operator === "none-of") &&
			values.length
		) {
			filter = { field, operator: node.operator, values };
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
		if (control.field === "realm-tag-vote") {
			for (const [field, selected] of [
				["realm", node.realmTagVote?.realm],
				["tag", node.realmTagVote?.tag],
			] as const) {
				if (!selected || typeof selected.value !== "string" || !selected.kind) continue;
				const selection = {
					field,
					value: selected.value,
					title: selected.label,
					kind: selected.kind,
				} satisfies SharedSearchQuerySelection;
				byValue.set(presentationKey(selection.field, selection.value), selection);
			}
			return;
		}
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
