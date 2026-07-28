import { t } from "elysia";

import { RealmUnitStatusValues } from "../../database/schema/contract-values";
import { parseJsonCursor } from "../../pagination";
import { InvalidPaginationCursor } from "../../pagination/errors";

export type RealmUnitModerationStatus = (typeof RealmUnitStatusValues)[number];

const RealmUnitModerationCursor = t.Object(
	{
		v: t.Literal(2),
		realmId: t.String({ format: "uuid" }),
		statusFilter: t.Nullable(t.UnionEnum(RealmUnitStatusValues)),
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
	readonly status?: RealmUnitModerationStatus;
	readonly reported?: boolean;
};

export function encodeRealmUnitModerationCursor(
	scope: RealmUnitModerationCursorScope,
	boundary: Omit<RealmUnitModerationCursorBoundary, "statusOrder">,
): string {
	return Buffer.from(
		JSON.stringify({
			v: 2,
			realmId: scope.realmId,
			statusFilter: scope.status ?? null,
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
			cursor.statusFilter !== (scope.status ?? null) ||
			cursor.reported !== (scope.reported ?? false) ||
			(scope.status !== undefined && cursor.status !== scope.status)
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
