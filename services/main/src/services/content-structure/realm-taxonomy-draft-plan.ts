import type { RealmTagQueryStrategy } from "../database/schema/contract-values";
import { ContentStructureInvalid } from "./errors";
import { planDraftSiblingPositions } from "./draft-batch";

export type RealmTaxonomyContentKind = "label" | "tag" | "wiki";

export type CurrentRealmTaxonomyDraftNode = {
	readonly id: string;
	readonly parentId: string | null;
	readonly position: string;
	readonly contentUnitId: string;
	readonly contentKind: RealmTaxonomyContentKind;
	readonly queryStrategy: RealmTagQueryStrategy | null;
};

export type ResolvedRealmTaxonomyDraftNode = {
	readonly state: "existing" | "new";
	readonly id: string;
	readonly parentId: string | null;
	readonly order: number;
	readonly contentUnitId: string | null;
	readonly contentKind: RealmTaxonomyContentKind;
	readonly queryStrategy: RealmTagQueryStrategy | null;
};

export type PlannedRealmTaxonomyDraftNode = ResolvedRealmTaxonomyDraftNode & {
	readonly position: string;
};

export type RealmTaxonomyDraftPlan = {
	readonly nodes: readonly PlannedRealmTaxonomyDraftNode[];
	readonly deletedNodeIds: ReadonlySet<string>;
	readonly hasChanges: boolean;
	readonly hasStructuralChanges: boolean;
};

function invalid(message: string): never {
	throw new ContentStructureInvalid(message);
}

/**
 * Proves that a complete Realm taxonomy draft has closed parent references and
 * derives the minimal persisted position changes. Parent cycles are accepted.
 */
export function planRealmTaxonomyDraft(
	currentNodes: readonly CurrentRealmTaxonomyDraftNode[],
	draftNodes: readonly ResolvedRealmTaxonomyDraftNode[],
): RealmTaxonomyDraftPlan {
	const currentById = new Map(currentNodes.map((node) => [node.id, node]));
	const draftById = new Map<string, ResolvedRealmTaxonomyDraftNode>();
	const tagUnitIds = new Set<string>();

	for (const draft of draftNodes) {
		if (draftById.has(draft.id)) invalid(`Duplicate Realm taxonomy node ${draft.id}`);
		if (!Number.isSafeInteger(draft.order) || draft.order < 0 || draft.order >= draftNodes.length)
			invalid(`Realm taxonomy node ${draft.id} has an invalid sibling order`);
		const current = currentById.get(draft.id);
		if (draft.state === "existing" && !current)
			invalid(`Realm taxonomy node ${draft.id} does not belong to this structure`);
		if (draft.state === "new" && current)
			invalid(`New Realm taxonomy node ${draft.id} already exists`);
		if (
			draft.state === "existing" &&
			current &&
			(current.contentUnitId !== draft.contentUnitId || current.contentKind !== draft.contentKind)
		)
			invalid(`Realm taxonomy node ${draft.id} cannot replace its content Unit`);
		if (draft.contentKind === "tag") {
			if (!draft.contentUnitId) invalid(`Realm taxonomy Tag node ${draft.id} has no content Unit`);
			if (!draft.queryStrategy)
				invalid(`Realm taxonomy Tag node ${draft.id} has no query strategy`);
			if (tagUnitIds.has(draft.contentUnitId))
				invalid(`Realm taxonomy contains Tag ${draft.contentUnitId} more than once`);
			tagUnitIds.add(draft.contentUnitId);
		} else if (draft.queryStrategy !== null) {
			invalid(`Realm taxonomy ${draft.contentKind} node ${draft.id} has a query strategy`);
		}
		if (draft.contentKind !== "label" && !draft.contentUnitId)
			invalid(`Realm taxonomy node ${draft.id} has no content Unit`);
		draftById.set(draft.id, draft);
	}

	for (const node of draftById.values())
		if (node.parentId !== null && !draftById.has(node.parentId))
			invalid(`Realm taxonomy node ${node.id} has a missing parent`);

	const draftSiblingIds = new Map<string | null, string[]>();
	for (const node of draftById.values()) {
		const siblings = draftSiblingIds.get(node.parentId) ?? [];
		if (siblings[node.order] !== undefined)
			invalid(
				`Realm taxonomy siblings under ${node.parentId ?? "root"} repeat order ${node.order}`,
			);
		siblings[node.order] = node.id;
		draftSiblingIds.set(node.parentId, siblings);
	}
	for (const [parentId, siblingIds] of draftSiblingIds) {
		if (
			Array.from({ length: siblingIds.length }, (_, index) => siblingIds[index]).some(
				(id) => id === undefined,
			)
		)
			invalid(`Realm taxonomy siblings under ${parentId ?? "root"} must use contiguous orders`);
	}

	const retainedIds = new Set(draftById.keys());
	const deletedNodeIds = new Set(
		currentNodes.filter(({ id }) => !retainedIds.has(id)).map(({ id }) => id),
	);
	const positionById = planDraftSiblingPositions({
		currentNodes,
		desiredNodes: [...draftById.values()],
	});

	const nodes = [...draftById.values()]
		.toSorted((left, right) => {
			if (left.parentId !== right.parentId)
				return (left.parentId ?? "").localeCompare(right.parentId ?? "");
			return left.order - right.order || left.id.localeCompare(right.id);
		})
		.map((node): PlannedRealmTaxonomyDraftNode => {
			const position = positionById.get(node.id);
			if (!position) throw new Error("Realm taxonomy node has no planned position");
			return {
				...node,
				position,
			};
		});
	const strategyChanged = nodes.some((node) => {
		const current = currentById.get(node.id);
		return current ? current.queryStrategy !== node.queryStrategy : false;
	});
	const hasStructuralChanges =
		nodes.some(({ state }) => state === "new") ||
		deletedNodeIds.size > 0 ||
		nodes.some((node) => {
			const current = currentById.get(node.id);
			return current
				? current.parentId !== node.parentId || current.position !== node.position
				: false;
		});
	return {
		nodes,
		deletedNodeIds,
		hasChanges: hasStructuralChanges || strategyChanged,
		hasStructuralChanges,
	};
}
