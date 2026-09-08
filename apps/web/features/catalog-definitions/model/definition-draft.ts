import { z } from "zod";
import { canonicalizeContentLanguageTag, parseContentLanguageTag } from "@rezics/content-language";
import type {
	CreateCatalogDefinitionBody,
	GetCatalogDefinitionRevisionStatus200,
} from "@rezics/openapi-tanstack-query";
export type DefinitionKind = CreateCatalogDefinitionBody["kind"];
export type DefinitionConstraints = CreateCatalogDefinitionBody["constraints"];
export type DefinitionRevision = GetCatalogDefinitionRevisionStatus200;
export type DefinitionValueKind = NonNullable<CreateCatalogDefinitionBody["valueKind"]>;
export const DefinitionKinds = [
	"class",
	"property",
	"predicate",
	"role",
	"vocabulary",
] as const satisfies readonly DefinitionKind[];
export const DefinitionValueKinds = [
	"null",
	"string",
	"number",
	"boolean",
	"object",
	"array",
] as const satisfies readonly DefinitionValueKind[];
export interface DefinitionSelection {
	readonly definitionId: string;
	readonly namespace: string;
	readonly key: string;
	readonly kind: DefinitionKind;
	readonly revision: DefinitionRevision;
}
export function definitionLabel(
	revision: DefinitionRevision,
	language: string,
): string | undefined {
	return (
		revision.labels.find((item) => item.languageTag === language) ??
		revision.labels.find((item) => item.languageTag.split("-")[0] === language.split("-")[0]) ??
		revision.labels[0]
	)?.label;
}
export interface DefinitionDraft {
	readonly namespace: string;
	readonly key: string;
	readonly kind: DefinitionKind;
	readonly valueKind: DefinitionValueKind;
	readonly constraints: DefinitionConstraints;
	readonly labels: readonly { languageTag: string; label: string; description: string }[];
	readonly reason: string;
}
export function createDefinitionDraft(
	languageTag: string,
	selected?: DefinitionSelection,
): DefinitionDraft {
	return {
		namespace: selected?.namespace ?? "",
		key: selected?.key ?? "",
		kind: selected?.kind ?? "property",
		valueKind: selected?.revision.valueKind ?? "string",
		constraints: selected?.revision.constraints ?? { nullable: false, integer: false },
		labels: selected?.revision.labels.map((label) => ({
			...label,
			description: label.description ?? "",
		})) ?? [{ languageTag, label: "", description: "" }],
		reason: "",
	};
}
function bytes(value: string, maximum: number, required = false) {
	if ((required && !value.trim()) || new TextEncoder().encode(value).length > maximum)
		throw new TypeError("invalid");
	return value.trim();
}
/** Inputs are built by typed controls; this boundary checks text/number budgets before the owning API validates the complete governed meaning. */
export function definitionDraftBody(
	draft: DefinitionDraft,
): CreateCatalogDefinitionBody | undefined {
	try {
		if (
			!/^[a-z][a-z0-9_.-]{0,95}$/u.test(draft.namespace) ||
			!draft.key.trim() ||
			draft.key.length > 160 ||
			draft.labels.length < 1 ||
			draft.labels.length > 32
		)
			return;
		const labels = draft.labels.map((item) => {
			const languageTag = canonicalizeContentLanguageTag(item.languageTag.trim());
			if (parseContentLanguageTag(languageTag).kind === "private-use")
				throw new TypeError("invalid");
			return {
				languageTag,
				label: bytes(item.label, 800, true),
				description: bytes(item.description, 4096) || null,
			};
		});
		if (new Set(labels.map((item) => item.languageTag)).size !== labels.length) return;
		const c = draft.constraints;
		const dependencies = [
			...(c.roles ?? []).map((role) => role.roleRevisionId),
			...(c.qualifierRevisionIds ?? []),
			...(c.memberRevisionIds ?? []),
			...(c.vocabularyRevisionId ? [c.vocabularyRevisionId] : []),
			...(c.rules ?? []).flatMap((rule) =>
				rule.vocabularyRevisionId ? [rule.vocabularyRevisionId] : [],
			),
		];
		if (dependencies.some((id) => !z.uuid().safeParse(id).success)) return;
		if (c.roles && new Set(c.roles.map((role) => role.roleRevisionId)).size !== c.roles.length)
			return;
		if ((c.roles ?? []).reduce((sum, role) => sum + role.min, 0) > 128) return;
		if (c.slots?.some((slot) => !/^[a-z][a-z0-9_.-]{0,95}$/u.test(slot))) return;
		if (new TextEncoder().encode(JSON.stringify(c)).length > 262144) return;

		if (
			(c.minimum !== undefined && c.maximum !== undefined && c.minimum > c.maximum) ||
			(c.minLength !== undefined && c.maxLength !== undefined && c.minLength > c.maxLength)
		)
			return;
		if (draft.kind === "predicate" && !c.roles?.length) return;
		if (c.roles?.some((role) => role.min > role.max || !role.targets.length)) return;
		if (c.targets?.some((target) => !target.shapes.length)) return;
		if (
			draft.kind === "property" &&
			["object", "array"].includes(draft.valueKind) &&
			(!c.rules?.length || c.rules[0]?.kind !== draft.valueKind)
		)
			return;
		if (
			c.rules?.some(
				(rule, index) =>
					rule.position !== index ||
					(index === 0
						? rule.parent !== null || rule.memberKey !== null
						: rule.parent === null || rule.parent >= index),
			)
		)
			return;

		if (c.rules)
			for (const [index, rule] of c.rules.entries()) {
				if (index === 0) continue;
				const parent = rule.parent === null ? undefined : c.rules[rule.parent];
				if (
					!parent ||
					(parent.kind !== "object" && parent.kind !== "array") ||
					(parent.kind === "array" ? rule.memberKey !== null : rule.memberKey === null)
				)
					return;
				if (
					c.rules
						.slice(0, index)
						.some(
							(previous) =>
								previous.parent === rule.parent && previous.memberKey === rule.memberKey,
						)
				)
					return;
			}
		return {
			namespace: draft.namespace,
			key: draft.key.trim(),
			kind: draft.kind,
			valueKind: draft.kind === "property" ? draft.valueKind : null,
			constraints: c,
			labels,
			reason: bytes(draft.reason, 8192, true),
		};
	} catch {
		return;
	}
}
