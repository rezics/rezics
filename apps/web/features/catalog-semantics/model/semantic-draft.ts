import type {
	WriteCatalogFactBody,
	WriteCatalogRelationBody,
} from "@rezics/openapi-tanstack-query";
import type { CatalogReference } from "@rezics/reference";
import type {
	DefinitionConstraints,
	DefinitionRevision,
} from "@/features/catalog-definitions/model/definition-draft";
export type ValueNode = WriteCatalogFactBody["nodes"][number];
export type ValueRule = NonNullable<DefinitionConstraints["rules"]>[number];
export type ValueDraftNode = {
	rulePosition: number;
	parentPosition: number | null;
	unknown: boolean;
	text: string;
	number: string;
	boolean: boolean;
};
export type ParticipantDraft = {
	roleRevisionId: string;
	target?: { reference: CatalogReference; shape: string; label: string };
	creditedAs: string;
};
export type QualifierDraft = { definitionRevisionId: string; valueFactId: string };
export type Replacement = { semanticId: string; headVersion: number };
export const SpoilerLevels = [0, 1, 2] as const;
export function valueRules(definition: DefinitionRevision): ValueRule[] {
	if (!definition.valueKind) return [];
	return (
		definition.constraints.rules ?? [
			{
				...definition.constraints,
				position: 0,
				parent: null,
				memberKey: null,
				kind: definition.valueKind,
			},
		]
	);
}
export function emptyValueNode(
	rulePosition: number,
	parentPosition: number | null,
): ValueDraftNode {
	return { rulePosition, parentPosition, unknown: false, text: "", number: "", boolean: false };
}
export function initialValueDraft(definition: DefinitionRevision): ValueDraftNode[] {
	return valueRules(definition).length ? [emptyValueNode(0, null)] : [];
}
export function addValueNode(
	rows: readonly ValueDraftNode[],
	rules: readonly ValueRule[],
	parentPosition: number,
	rulePosition: number,
): ValueDraftNode[] | null {
	if (rows.length >= 512) return null;
	const parent = rows[parentPosition],
		rule = rules[rulePosition],
		parentRule = parent ? rules[parent.rulePosition] : undefined;
	if (
		!parent ||
		parent.unknown ||
		!rule ||
		!parentRule ||
		rule.parent !== parentRule.position ||
		!(parentRule.kind === "array" || parentRule.kind === "object")
	)
		return null;
	if (
		parentRule.kind === "object" &&
		rows.some((row) => row.parentPosition === parentPosition && row.rulePosition === rulePosition)
	)
		return null;
	let depth = 1,
		current: number | null = parentPosition;
	while (current !== null) {
		depth++;
		current = rows[current]?.parentPosition ?? null;
		if (depth > 64) return null;
	}
	return [...rows, emptyValueNode(rulePosition, parentPosition)];
}
export function removeValueNode(
	rows: readonly ValueDraftNode[],
	position: number,
): ValueDraftNode[] {
	if (position === 0) return [...rows];
	const removed = new Set([position]);
	for (const [index, row] of rows.entries())
		if (row.parentPosition !== null && removed.has(row.parentPosition)) removed.add(index);
	const indices = new Map<number, number>(),
		result: ValueDraftNode[] = [];
	for (const [index, row] of rows.entries()) {
		if (removed.has(index)) continue;
		indices.set(index, result.length);
		result.push({
			...row,
			parentPosition:
				row.parentPosition === null ? null : (indices.get(row.parentPosition) ?? null),
		});
	}
	return result;
}
export function setValueUnknown(
	rows: readonly ValueDraftNode[],
	position: number,
	unknown: boolean,
): ValueDraftNode[] {
	let result = rows.map((row, index) => (index === position ? { ...row, unknown } : row));
	if (unknown) {
		let child = result.findIndex((row) => row.parentPosition === position);
		while (child >= 0) {
			result = removeValueNode(result, child);
			child = result.findIndex((row) => row.parentPosition === position);
		}
	}
	return result;
}
export function valueDraftFromNodes(
	definition: DefinitionRevision,
	nodes: readonly ValueNode[],
): ValueDraftNode[] | null {
	const rules = valueRules(definition),
		result: ValueDraftNode[] = [];
	if (!nodes.length || nodes.length > 512) return null;
	for (const [index, node] of nodes.entries()) {
		if (node.position !== index) return null;
		const parent = node.parentPosition === null ? undefined : result[node.parentPosition];
		const rule =
			index === 0
				? rules[0]
				: rules.find(
						(rule) => rule.parent === parent?.rulePosition && rule.memberKey === node.memberKey,
					);
		if (!rule || (node.kind !== rule.kind && !(node.kind === "null" && rule.nullable))) return null;
		result.push({
			rulePosition: rule.position,
			parentPosition: node.parentPosition,
			unknown: node.kind === "null" && rule.kind !== "null",
			text: node.textValue ?? "",
			number: node.numberValue ?? "",
			boolean: node.booleanValue ?? false,
		});
	}
	return result;
}
function scalarValid(node: ValueNode, rule: ValueRule) {
	if (node.kind === "null" && rule.nullable) return true;
	if (node.kind !== rule.kind) return false;
	const value =
		node.kind === "string"
			? node.textValue
			: node.kind === "number"
				? Number(node.numberValue)
				: node.kind === "boolean"
					? node.booleanValue
					: null;
	if (node.kind === "number") {
		if (
			!node.numberValue ||
			node.numberValue.length > 4096 ||
			!/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d{1,4})?$/u.test(node.numberValue)
		)
			return false;
		if (
			rule.minimum !== undefined ||
			rule.maximum !== undefined ||
			rule.integer ||
			rule.allowedValues
		) {
			if (
				typeof value !== "number" ||
				!Number.isFinite(value) ||
				(rule.integer && !Number.isSafeInteger(value)) ||
				(rule.minimum !== undefined && value < rule.minimum) ||
				(rule.maximum !== undefined && value > rule.maximum)
			)
				return false;
		}
	}
	if (
		typeof value === "string" &&
		((rule.minLength !== undefined && [...value].length < rule.minLength) ||
			(rule.maxLength !== undefined && [...value].length > rule.maxLength))
	)
		return false;
	return !rule.allowedValues || rule.allowedValues.some((allowed) => allowed === value);
}
export function buildFactBody(
	definition: DefinitionRevision,
	rows: readonly ValueDraftNode[],
	expectedRevision: number,
	spoiler: 0 | 1 | 2,
	replaces?: Replacement,
): WriteCatalogFactBody | null {
	const rules = valueRules(definition),
		nodes: ValueNode[] = [];
	if (!rows.length || rows.length > 512) return null;
	for (const [position, row] of rows.entries()) {
		const rule = rules[row.rulePosition];
		if (!rule) return null;
		const parent = row.parentPosition === null ? undefined : rows[row.parentPosition],
			parentRule = parent ? rules[parent.rulePosition] : undefined;
		if (
			position === 0
				? row.parentPosition !== null || row.rulePosition !== 0
				: row.parentPosition === null ||
					row.parentPosition >= position ||
					!parent ||
					parent.unknown ||
					!parentRule ||
					rule.parent !== parent.rulePosition
		)
			return null;
		if (parentRule && parentRule.kind !== "object" && parentRule.kind !== "array") return null;
		const parentKind =
			parentRule?.kind === "array" ? "array" : parentRule?.kind === "object" ? "object" : null;
		const kind = row.unknown ? "null" : rule.kind;
		const node: ValueNode = {
			position,
			parentPosition: row.parentPosition,
			parentKind,
			memberKey: parentKind === "object" ? rule.memberKey : null,
			kind,
			textValue: kind === "string" ? row.text : null,
			numberValue: kind === "number" ? row.number.trim() : null,
			booleanValue: kind === "boolean" ? row.boolean : null,
		};
		if (!scalarValid(node, rule)) return null;
		if (
			parentKind === "object" &&
			nodes.some(
				(previous) =>
					previous.parentPosition === row.parentPosition && previous.memberKey === node.memberKey,
			)
		)
			return null;
		nodes.push(node);
	}
	if (new TextEncoder().encode(JSON.stringify(nodes)).length > 512_000) return null;
	return {
		expectedRevision,
		definitionRevisionId: definition.id,
		spoiler,
		nodes,
		...(replaces ? { replaces } : {}),
	};
}
export function buildRelationBody(
	definition: DefinitionRevision,
	participants: readonly ParticipantDraft[],
	qualifiers: readonly QualifierDraft[],
	expectedRevision: number,
	spoiler: 0 | 1 | 2,
	replaces?: Replacement,
): WriteCatalogRelationBody | null {
	const roles = definition.constraints.roles;
	if (!roles?.length || !participants.length || participants.length > 128 || qualifiers.length > 64)
		return null;
	const admitted: WriteCatalogRelationBody["participants"] = [];
	for (const participant of participants) {
		const role = roles.find((role) => role.roleRevisionId === participant.roleRevisionId),
			target = participant.target;
		if (
			!role ||
			!target ||
			!role.targets.some(
				(allowed) =>
					allowed.owner === target.reference.owner && allowed.shapes.includes(target.shape),
			) ||
			participant.creditedAs.length > 131072
		)
			return null;
		admitted.push({
			roleRevisionId: participant.roleRevisionId,
			target: target.reference,
			...(participant.creditedAs ? { creditedAs: participant.creditedAs } : {}),
		});
	}
	for (const role of roles) {
		const count = participants.filter(
			(participant) => participant.roleRevisionId === role.roleRevisionId,
		).length;
		if (count < role.min || count > role.max) return null;
	}
	if (
		qualifiers.some(
			(qualifier) =>
				!definition.constraints.qualifierRevisionIds?.includes(qualifier.definitionRevisionId),
		) ||
		new Set(qualifiers.map((value) => value.definitionRevisionId)).size !== qualifiers.length
	)
		return null;
	const body: WriteCatalogRelationBody = {
		expectedRevision,
		definitionRevisionId: definition.id,
		spoiler,
		participants: admitted,
		qualifiers: [...qualifiers],
		...(replaces ? { replaces } : {}),
	};
	return new TextEncoder().encode(JSON.stringify(body)).length <= 512_000 ? body : null;
}
