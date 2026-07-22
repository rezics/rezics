import { type UnitKind, UnitKindValues } from "../database/schema/contract-values";

export const FollowableUnitKindValues = [
	"profile",
	"entity",
	"zone",
	"realm",
] as const satisfies readonly UnitKind[];
export type FollowableUnitKind = (typeof FollowableUnitKindValues)[number];

const followableUnitKinds: ReadonlySet<UnitKind> = new Set(FollowableUnitKindValues);

export function isFollowableUnitKind(kind: UnitKind): kind is FollowableUnitKind {
	return followableUnitKinds.has(kind);
}

export const NonFollowableUnitKindValues = UnitKindValues.filter(
	(kind) => !isFollowableUnitKind(kind),
);
