import { t } from "elysia";

import { parseJsonCursor } from "../pagination";
import { InvalidPaginationCursor } from "../pagination/errors";
import type { UnitOwnershipClaimCursorBoundary } from "./service";

const UnitOwnershipClaimCursor = t.Object(
	{
		v: t.Literal(1),
		createdAt: t.String({ format: "date-time" }),
		id: t.String({ format: "uuid" }),
	},
	{ additionalProperties: false },
);

export function decodeUnitOwnershipClaimCursor(
	value: string | undefined,
): UnitOwnershipClaimCursorBoundary | undefined {
	if (!value) return undefined;
	try {
		const cursor = parseJsonCursor(value, UnitOwnershipClaimCursor);
		const createdAt = new Date(cursor.createdAt);
		if (Number.isNaN(createdAt.getTime())) throw new InvalidPaginationCursor();
		return { createdAt, id: cursor.id };
	} catch {
		throw new InvalidPaginationCursor();
	}
}

export function encodeUnitOwnershipClaimCursor(boundary: UnitOwnershipClaimCursorBoundary): string {
	return Buffer.from(
		JSON.stringify({
			v: 1,
			createdAt: boundary.createdAt.toISOString(),
			id: boundary.id,
		}),
	).toString("base64url");
}
