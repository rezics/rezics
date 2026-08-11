import { and, desc, eq, lt, or, sql } from "drizzle-orm";
import { t } from "elysia";

import { unitProgressEntry } from "../../database/schema";
import { ProgressStatusValues } from "../../database/schema/contract-values";
import { parseJsonCursor } from "../../pagination";
import { InvalidPaginationCursor } from "../../pagination/errors";
import { Uuid } from "../schema";

const ProgressEntryCursor = t.Object(
	{
		v: t.Literal(2),
		unitId: Uuid,
		status: t.Nullable(t.UnionEnum(ProgressStatusValues)),
		sortAt: t.String({ format: "date-time" }),
		createdAt: t.String({ format: "date-time" }),
		id: Uuid,
	},
	{ additionalProperties: false },
);

export interface ProgressEntryCursorBoundary {
	readonly sortAt: Date;
	readonly createdAt: Date;
	readonly id: string;
}

export interface ProgressEntryCursorScope {
	readonly unitId: string;
	readonly status?: (typeof ProgressStatusValues)[number];
}

export const progressEntrySortAt = sql<Date>`coalesce(${unitProgressEntry.occurredAt}, ${unitProgressEntry.createdAt})`;

export const progressEntryOrderBy = [
	desc(progressEntrySortAt),
	desc(unitProgressEntry.createdAt),
	desc(unitProgressEntry.id),
] as const;

export function resolveProgressEntrySortAt(entry: {
	readonly occurredAt: Date | null;
	readonly createdAt: Date;
}): Date {
	return entry.occurredAt ?? entry.createdAt;
}

export function decodeProgressEntryCursor(
	value: string | undefined,
	scope: ProgressEntryCursorScope,
): ProgressEntryCursorBoundary | undefined {
	if (!value) return undefined;
	try {
		const cursor = parseJsonCursor(value, ProgressEntryCursor);
		if (cursor.unitId !== scope.unitId || cursor.status !== (scope.status ?? null))
			throw new InvalidPaginationCursor();
		const sortAt = new Date(cursor.sortAt);
		const createdAt = new Date(cursor.createdAt);
		if (Number.isNaN(sortAt.getTime()) || Number.isNaN(createdAt.getTime()))
			throw new InvalidPaginationCursor();
		return { sortAt, createdAt, id: cursor.id };
	} catch {
		throw new InvalidPaginationCursor();
	}
}

export function encodeProgressEntryCursor(
	scope: ProgressEntryCursorScope,
	boundary: ProgressEntryCursorBoundary,
): string {
	return Buffer.from(
		JSON.stringify({
			v: 2,
			unitId: scope.unitId,
			status: scope.status ?? null,
			sortAt: boundary.sortAt.toISOString(),
			createdAt: boundary.createdAt.toISOString(),
			id: boundary.id,
		}),
	).toString("base64url");
}

export function progressEntryCursorCondition(cursor: ProgressEntryCursorBoundary | undefined) {
	if (!cursor) return undefined;
	return or(
		lt(progressEntrySortAt, cursor.sortAt),
		and(
			eq(progressEntrySortAt, cursor.sortAt),
			or(
				lt(unitProgressEntry.createdAt, cursor.createdAt),
				and(eq(unitProgressEntry.createdAt, cursor.createdAt), lt(unitProgressEntry.id, cursor.id)),
			),
		),
	);
}
