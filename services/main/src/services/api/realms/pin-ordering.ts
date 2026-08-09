import {
	fractionalPositionsBetween,
	rebalanceFractionalPositionSequence,
} from "../../ordering/position";
import { peekActiveObservability } from "@rezics/observability";
import type { MoveRealmPinsBody, RealmPinKind } from "./schema";

export interface OrderedRealmPin {
	readonly unitId: string;
	readonly kind: RealmPinKind;
	readonly position: string;
}

export interface PlannedRealmPinPosition {
	readonly unitId: string;
	readonly kind: RealmPinKind;
	readonly position: string;
}

export type RealmPinMovePlan =
	| {
			readonly ok: true;
			readonly positions: readonly PlannedRealmPinPosition[];
	  }
	| {
			readonly ok: false;
			readonly field: "unitIds" | "placement";
			readonly message: string;
	  };

/**
 * Plans one ordered Realm pin move without exposing fractional positions to callers.
 *
 * @remarks
 * `orderedPins` must use the canonical Realm pin order. Selected pins must come from one
 * source category so their existing relative order has an unambiguous meaning.
 */
export function planRealmPinMove(
	orderedPins: readonly OrderedRealmPin[],
	request: MoveRealmPinsBody,
): RealmPinMovePlan {
	const selectedIds = new Set(request.unitIds);
	if (selectedIds.size !== request.unitIds.length)
		return {
			ok: false,
			field: "unitIds",
			message: "unitId values must be unique",
		};
	if (selectedIds.size === 0)
		return {
			ok: false,
			field: "unitIds",
			message: "at least one Realm pin must be selected",
		};

	const selectedPins = orderedPins.filter(({ unitId }) => selectedIds.has(unitId));
	if (selectedPins.length !== selectedIds.size)
		return {
			ok: false,
			field: "unitIds",
			message: "every moved item must be pinned in this Realm",
		};

	const sourceKind = selectedPins[0]?.kind;
	if (!sourceKind || selectedPins.some(({ kind }) => kind !== sourceKind))
		return {
			ok: false,
			field: "unitIds",
			message: "moved Realm pins must come from one category",
		};

	const destinationPins = orderedPins.filter(
		({ unitId, kind }) => kind === request.destinationKind && !selectedIds.has(unitId),
	);
	let destinationIndex: number;
	if (request.placement.kind === "after") {
		const anchorUnitId = request.placement.unitId;
		const anchorIndex = destinationPins.findIndex(({ unitId }) => unitId === anchorUnitId);
		if (anchorIndex < 0)
			return {
				ok: false,
				field: "placement",
				message: "the destination must be an unselected pin in the destination category",
			};
		destinationIndex = anchorIndex + 1;
	} else if (request.placement.kind === "start") {
		destinationIndex = 0;
	} else {
		destinationIndex = destinationPins.length;
	}

	const originalPositionById = new Map(
		orderedPins.map(({ unitId, position }) => [unitId, position] as const),
	);
	const rebalancedIds = new Set<string>();
	const destinationRebalance = rebalanceFractionalPositionSequence(
		destinationPins.map(({ position }) => position),
	);
	for (const index of destinationRebalance.changedIndexes) {
		const pin = destinationPins[index];
		const position = destinationRebalance.positions[index];
		if (!pin || !position) throw new Error("Realm pin rebalance lost a destination pin");
		destinationPins[index] = { ...pin, position };
		rebalancedIds.add(pin.unitId);
	}
	const beforePosition =
		destinationIndex > 0 ? (destinationPins[destinationIndex - 1]?.position ?? null) : null;
	const afterPosition =
		destinationIndex < destinationPins.length
			? (destinationPins[destinationIndex]?.position ?? null)
			: null;
	const positions = fractionalPositionsBetween(
		beforePosition,
		afterPosition,
		selectedPins.length,
	);
	const destinationOrder = [...destinationPins];
	destinationOrder.splice(
		destinationIndex,
		0,
		...selectedPins.map((pin, index) => {
			const position = positions[index];
			if (!position)
				throw new Error("Fractional position generation returned too few values");
			return { ...pin, kind: request.destinationKind, position };
		}),
	);
	const finalRebalance = rebalanceFractionalPositionSequence(
		destinationOrder.map(({ position }) => position),
	);
	for (const index of finalRebalance.changedIndexes) {
		const pin = destinationOrder[index];
		const position = finalRebalance.positions[index];
		if (!pin || !position) throw new Error("Realm pin rebalance lost a moved pin");
		destinationOrder[index] = { ...pin, position };
		rebalancedIds.add(pin.unitId);
	}
	if (rebalancedIds.size)
		peekActiveObservability()?.metrics.fractionalPositionRebalanced(
			"realm-pin",
			rebalancedIds.size,
		);
	return {
		ok: true,
		positions: destinationOrder.flatMap((pin) =>
			selectedIds.has(pin.unitId) || originalPositionById.get(pin.unitId) !== pin.position
				? [
						{
							unitId: pin.unitId,
							kind: request.destinationKind,
							position: pin.position,
						},
					]
				: [],
		),
	};
}
