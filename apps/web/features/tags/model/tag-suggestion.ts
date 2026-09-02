import type { GetApiTagsSuggestionsStatus200 } from "@rezics/openapi-tanstack-query";

export type TagSuggestionResponseItem = GetApiTagsSuggestionsStatus200["items"][number];

type TagSelectionOptionBase = {
	readonly selectionKey: string;
	readonly tagId: string;
	readonly label: string;
	readonly pathLabel: string | null;
	readonly usageCount: number;
	readonly matchKind: "exact" | "prefix" | "token" | "fuzzy";
	readonly matchSource: "direct_tag" | "expression_component" | "path_member";
};

export type TagSelectionOption = TagSelectionOptionBase &
	(
		| { readonly kind: "direct_expression"; readonly senseId: null }
		| { readonly kind: "path_sense"; readonly senseId: string }
	);

export function presentTagSuggestion(
	item: TagSuggestionResponseItem,
	fallbacks: { readonly unnamedTag: string; readonly unnamedPathMember: string },
): TagSelectionOption {
	const label =
		item.expression.components
			.filter(({ componentKind }) => componentKind === "required")
			.map(({ title }) => title ?? fallbacks.unnamedTag)
			.join(" · ") || fallbacks.unnamedTag;
	const pathLabel = item.members.length
		? item.members.map(({ title }) => title ?? fallbacks.unnamedPathMember).join(" › ")
		: null;
	const base = {
		selectionKey: item.selectionKey,
		tagId: item.expression.focusTagId,
		label,
		pathLabel,
		usageCount: item.usageCount,
		matchKind: item.match.kind,
		matchSource: item.match.source,
	};
	return item.selection === "direct_expression"
		? { ...base, kind: item.selection, senseId: null }
		: { ...base, kind: item.selection, senseId: item.senseId };
}
