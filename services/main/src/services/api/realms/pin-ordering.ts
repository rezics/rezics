import { fractionalPositionsBetween } from "../../ordering/position";
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
	let beforePosition: string | null;
	let afterPosition: string | null;
	if (request.placement.kind === "after") {
		const anchorUnitId = request.placement.unitId;
		const anchorIndex = destinationPins.findIndex(({ unitId }) => unitId === anchorUnitId);
		if (anchorIndex < 0)
			return {
				ok: false,
				field: "placement",
				message: "the destination must be an unselected pin in the destination category",
			};
		beforePosition = destinationPins[anchorIndex]?.position ?? null;
		afterPosition = destinationPins[anchorIndex + 1]?.position ?? null;
	} else if (request.placement.kind === "start") {
		beforePosition = null;
		afterPosition = destinationPins[0]?.position ?? null;
	} else {
		beforePosition = destinationPins.at(-1)?.position ?? null;
		afterPosition = null;
	}

	const positions = fractionalPositionsBetween(
		beforePosition,
		afterPosition,
		selectedPins.length,
	);
	return {
		ok: true,
		positions: selectedPins.map((pin, index) => {
			const position = positions[index];
			if (!position)
				throw new Error("Fractional position generation returned too few values");
			return {
				unitId: pin.unitId,
				kind: request.destinationKind,
				position,
			};
		}),
	};
}
