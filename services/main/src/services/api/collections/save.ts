import { fractionalPositionBetween } from "../../ordering/position";

export type PlannedCollectionInsertion = {
	readonly targetId: string;
	readonly position: string;
};

export type PlannedRequestedCollectionItem = {
	readonly targetId: string;
	readonly state: "created" | "existing";
};

/**
 * Plan missing flat Collection memberships without changing existing order.
 *
 * A requested Review may name an authoritative subject. When that subject is
 * absent, it is inserted directly before an existing Review or immediately
 * before a newly appended Review. This is an insertion convenience, not a
 * persistent Collection relationship.
 */
export function planCollectionItemInsertions(input: {
	readonly requestedTargetIds: readonly string[];
	readonly existingPositionByTargetId: ReadonlyMap<string, string>;
	readonly lastPosition: string | undefined;
	readonly positionBeforeReviewByTargetId: ReadonlyMap<string, string | null>;
	readonly reviewSubjectByTargetId: ReadonlyMap<string, string>;
}): {
	readonly insertions: readonly PlannedCollectionInsertion[];
	readonly requestedItems: readonly PlannedRequestedCollectionItem[];
} {
	if (!input.requestedTargetIds.length)
		throw new TypeError("At least one Collection target ID must be requested");
	const requestedIds = new Set(input.requestedTargetIds);
	if (requestedIds.size !== input.requestedTargetIds.length)
		throw new TypeError("Requested Collection target IDs must be unique");

	const initialIds = new Set(input.existingPositionByTargetId.keys());
	const currentIds = new Set(initialIds);
	const insertions: PlannedCollectionInsertion[] = [];
	let lastPosition = input.lastPosition;

	const append = (targetId: string) => {
		const position = fractionalPositionBetween(lastPosition, null);
		const insertion = { targetId, position };
		lastPosition = position;
		currentIds.add(targetId);
		insertions.push(insertion);
	};

	for (const targetId of input.requestedTargetIds) {
		const subjectId = input.reviewSubjectByTargetId.get(targetId);
		if (subjectId && !currentIds.has(subjectId)) {
			const reviewPosition = input.existingPositionByTargetId.get(targetId);
			if (reviewPosition === undefined) append(subjectId);
			else {
				if (!input.positionBeforeReviewByTargetId.has(targetId))
					throw new TypeError(
						`Missing predecessor position for existing Review ${targetId}`,
					);
				const position = fractionalPositionBetween(
					input.positionBeforeReviewByTargetId.get(targetId) ?? undefined,
					reviewPosition,
				);
				const insertion = { targetId: subjectId, position };
				currentIds.add(subjectId);
				insertions.push(insertion);
			}
		}
		if (!currentIds.has(targetId)) append(targetId);
	}

	return {
		insertions,
		requestedItems: input.requestedTargetIds.map((targetId) => ({
			targetId,
			state: initialIds.has(targetId) ? "existing" : "created",
		})),
	};
}
