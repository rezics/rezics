import { t } from "elysia";

import {
	RealmUnitPublicationStateValues,
	RealmUnitStatusValues,
} from "../../database/schema/contract-values";
import { parseJsonCursor } from "../../pagination";
import { InvalidPaginationCursor } from "../../pagination/errors";

export type RealmUnitModerationStatus = (typeof RealmUnitStatusValues)[number];
export type RealmUnitModerationStatusFilter = RealmUnitModerationStatus | "current" | "all";
export type RealmUnitModerationPublicationStateFilter =
	| (typeof RealmUnitPublicationStateValues)[number]
	| "all";

function isRealmUnitModerationStatus(
	value: RealmUnitModerationStatusFilter,
): value is RealmUnitModerationStatus {
	return RealmUnitStatusValues.some((status) => status === value);
}

const RealmUnitModerationCursor = t.Object(
	{
		v: t.Literal(3),
		realmId: t.String({ format: "uuid" }),
		statusFilter: t.UnionEnum(["current", ...RealmUnitStatusValues, "all"]),
		publicationStateFilter: t.UnionEnum([...RealmUnitPublicationStateValues, "all"]),
		reported: t.Boolean(),
		status: t.UnionEnum(RealmUnitStatusValues),
		updatedAt: t.String({ format: "date-time" }),
		unitId: t.String({ format: "uuid" }),
	},
	{ additionalProperties: false },
);

export const RealmUnitModerationStatusOrder = {
	pending: 0,
	hidden: 1,
	removed: 2,
	visible: 3,
} as const satisfies Record<RealmUnitModerationStatus, number>;

export type RealmUnitModerationCursorBoundary = {
	readonly status: RealmUnitModerationStatus;
	readonly statusOrder: number;
	readonly updatedAt: Date;
	readonly unitId: string;
};

type RealmUnitModerationCursorScope = {
	readonly realmId: string;
	readonly status: RealmUnitModerationStatusFilter;
	readonly publicationState: RealmUnitModerationPublicationStateFilter;
	readonly reported?: boolean;
};

export function encodeRealmUnitModerationCursor(
	scope: RealmUnitModerationCursorScope,
	boundary: Omit<RealmUnitModerationCursorBoundary, "statusOrder">,
): string {
	return Buffer.from(
		JSON.stringify({
			v: 3,
			realmId: scope.realmId,
			statusFilter: scope.status,
			publicationStateFilter: scope.publicationState,
			reported: scope.reported ?? false,
			status: boundary.status,
			updatedAt: boundary.updatedAt.toISOString(),
			unitId: boundary.unitId,
		}),
	).toString("base64url");
}

export function decodeRealmUnitModerationCursor(
	value: string | undefined,
	scope: RealmUnitModerationCursorScope,
): RealmUnitModerationCursorBoundary | undefined {
	if (!value) return undefined;
	try {
		const cursor = parseJsonCursor(value, RealmUnitModerationCursor);
		if (
			cursor.realmId !== scope.realmId ||
			cursor.statusFilter !== scope.status ||
			cursor.publicationStateFilter !== scope.publicationState ||
			cursor.reported !== (scope.reported ?? false) ||
			(isRealmUnitModerationStatus(scope.status) && cursor.status !== scope.status)
		)
			throw new InvalidPaginationCursor();
		const updatedAt = new Date(cursor.updatedAt);
		if (Number.isNaN(updatedAt.getTime())) throw new InvalidPaginationCursor();
		return {
			status: cursor.status,
			statusOrder: RealmUnitModerationStatusOrder[cursor.status],
			updatedAt,
			unitId: cursor.unitId,
		};
	} catch {
		throw new InvalidPaginationCursor();
	}
}
