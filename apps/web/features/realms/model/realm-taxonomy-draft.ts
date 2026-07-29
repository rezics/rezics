import type {
	GetApiRealmsByRealmIdTaxonomyDraftStatus200,
	PutApiRealmsByRealmIdTaxonomyDraftBody,
} from "@rezics/openapi-tanstack-query";
import type { EntityPickerValue } from "@rezics/ui";

export const RealmTaxonomyQueryStrategies = [
	"global_effective",
	"realm_community",
	"realm_policy",
] as const;

export type RealmTaxonomyQueryStrategy = (typeof RealmTaxonomyQueryStrategies)[number];

type TaxonomyResponseItem = GetApiRealmsByRealmIdTaxonomyDraftStatus200["items"][number];
export type RealmTaxonomyLanguage = TaxonomyResponseItem["language"];

type RealmTaxonomyDraftNodeBase = {
	readonly id: string;
	readonly parentId: string | null;
	readonly order: number;
	readonly title: string;
	readonly summary: string | null;
	readonly avatar: EntityPickerValue["avatar"];
};

export type RealmTaxonomyDraftNode =
	| (RealmTaxonomyDraftNodeBase & {
			readonly state: "existing";
			readonly contentUnitId: string;
			readonly contentKind: TaxonomyResponseItem["contentKind"];
			readonly language: RealmTaxonomyLanguage;
			readonly queryStrategy: RealmTaxonomyQueryStrategy | null;
	  })
	| (RealmTaxonomyDraftNodeBase & {
			readonly state: "new-label";
			readonly contentKind: "label";
			readonly language: RealmTaxonomyLanguage;
			readonly queryStrategy: null;
	  })
	| (RealmTaxonomyDraftNodeBase & {
			readonly state: "new-unit";
			readonly contentUnitId: string;
			readonly contentKind: "tag" | "wiki";
			readonly language: RealmTaxonomyLanguage;
			readonly queryStrategy: RealmTaxonomyQueryStrategy | null;
	  });

function indexOrders(items: readonly TaxonomyResponseItem[]): ReadonlyMap<string, number> {
	const siblings = new Map<string | null, TaxonomyResponseItem[]>();
	for (const item of items) {
		const entries = siblings.get(item.parentId);
		if (entries) entries.push(item);
		else siblings.set(item.parentId, [item]);
	}
	const result = new Map<string, number>();
	for (const entries of siblings.values()) {
		entries
			.toSorted(
				(left, right) =>
					left.position.localeCompare(right.position) || left.id.localeCompare(right.id),
			)
			.forEach(({ id }, order) => result.set(id, order));
	}
	return result;
}

export function createRealmTaxonomyDraft(
	response: GetApiRealmsByRealmIdTaxonomyDraftStatus200,
): RealmTaxonomyDraftNode[] {
	const orders = indexOrders(response.items);
	return response.items.map((item) => ({
		state: "existing",
		id: item.id,
		parentId: item.parentId,
		order: orders.get(item.id) ?? 0,
		contentUnitId: item.contentUnitId,
		contentKind: item.contentKind,
		language: item.language,
		title: item.title ?? "",
		summary: item.summary,
		avatar: item.avatar,
		queryStrategy: item.queryStrategy,
	}));
}

export function createRealmTaxonomyLabel(input: {
	readonly id: string;
	readonly language: RealmTaxonomyLanguage;
	readonly order: number;
	readonly parentId: string | null;
	readonly title: string;
}): RealmTaxonomyDraftNode {
	return {
		state: "new-label",
		id: input.id,
		parentId: input.parentId,
		order: input.order,
		contentKind: "label",
		language: input.language,
		title: input.title,
		summary: null,
		avatar: null,
		queryStrategy: null,
	};
}

export function createRealmTaxonomyUnit(input: {
	readonly id: string;
	readonly language: RealmTaxonomyLanguage;
	readonly order: number;
	readonly parentId: string | null;
	readonly presentation: EntityPickerValue;
	readonly contentKind: "tag" | "wiki";
}): RealmTaxonomyDraftNode {
	return {
		state: "new-unit",
		id: input.id,
		parentId: input.parentId,
		order: input.order,
		contentUnitId: input.presentation.id,
		contentKind: input.contentKind,
		language: input.language,
		title: input.presentation.label,
		summary: null,
		avatar: input.presentation.avatar,
		queryStrategy: input.contentKind === "tag" ? "global_effective" : null,
	};
}

export function renameRealmTaxonomyLabel(
	nodes: readonly RealmTaxonomyDraftNode[],
	nodeId: string,
	title: string,
): RealmTaxonomyDraftNode[] {
	return nodes.map((node) =>
		node.id === nodeId && node.state === "new-label" ? { ...node, title } : node,
	);
}

export function toRealmTaxonomySaveNodes(
	nodes: readonly RealmTaxonomyDraftNode[],
): PutApiRealmsByRealmIdTaxonomyDraftBody["nodes"] {
	return nodes.map((node) => {
		const placement = {
			id: node.id,
			parentId: node.parentId,
			order: node.order,
			queryStrategy: node.queryStrategy,
		};
		if (node.state === "existing") return { state: "existing" as const, ...placement };
		if (node.state === "new-label")
			return {
				state: "new" as const,
				...placement,
				queryStrategy: null,
				content: {
					kind: "label" as const,
					language: node.language,
					title: node.title.trim(),
				},
			};
		return {
			state: "new" as const,
			...placement,
			content: { kind: "unit" as const, unitId: node.contentUnitId },
		};
	});
}

export function realmTaxonomyDraftFingerprint(nodes: readonly RealmTaxonomyDraftNode[]): string {
	return JSON.stringify(toRealmTaxonomySaveNodes(nodes));
}

export function realmTaxonomyDraftIsValid(nodes: readonly RealmTaxonomyDraftNode[]): boolean {
	if (nodes.length > 10_000) return false;
	const ids = new Set(nodes.map(({ id }) => id));
	if (ids.size !== nodes.length) return false;
	const contentUnitIds = new Set<string>();
	for (const node of nodes) {
		if (node.parentId !== null && !ids.has(node.parentId)) return false;
		if (node.state === "new-label" && !node.title.trim()) return false;
		if (node.state !== "new-label") {
			if (contentUnitIds.has(node.contentUnitId)) return false;
			contentUnitIds.add(node.contentUnitId);
		}
		if (node.contentKind !== "tag" && node.queryStrategy !== null) return false;
	}
	return true;
}
