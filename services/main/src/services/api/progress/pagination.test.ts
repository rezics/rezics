import { sql } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import { InvalidPaginationCursor } from "../../pagination/errors";
import {
	decodeProgressEntryCursor,
	encodeProgressEntryCursor,
	progressEntryCursorCondition,
	progressEntryOrderBy,
	resolveProgressEntrySortAt,
} from "./pagination";

const UnitId = "019fa3ab-72a9-7792-b2e3-43aa8a9c755d";
const EntryId = "019fa3ab-72a9-7792-b2e3-43aa8a9c755e";

describe("Progress entry pagination", () => {
	it("prefers the reported occurrence time and falls back to creation time", () => {
		const occurredAt = new Date("2026-07-20T12:00:00.000Z");
		const createdAt = new Date("2026-07-31T12:00:00.000Z");

		expect(resolveProgressEntrySortAt({ occurredAt, createdAt })).toBe(occurredAt);
		expect(resolveProgressEntrySortAt({ occurredAt: null, createdAt })).toBe(createdAt);
	});

	it("round-trips the complete effective-time ordering boundary", () => {
		const scope = { unitId: UnitId, status: "active" as const };
		const boundary = {
			sortAt: new Date("2026-07-20T12:00:00.000Z"),
			createdAt: new Date("2026-07-31T12:00:00.000Z"),
			id: EntryId,
		};

		expect(decodeProgressEntryCursor(encodeProgressEntryCursor(scope, boundary), scope)).toEqual(
			boundary,
		);
	});

	it("binds the cursor to its Unit and status filter", () => {
		const scope = { unitId: UnitId, status: "active" as const };
		const cursor = encodeProgressEntryCursor(scope, {
			sortAt: new Date("2026-07-20T12:00:00.000Z"),
			createdAt: new Date("2026-07-31T12:00:00.000Z"),
			id: EntryId,
		});

		expect(() => decodeProgressEntryCursor(cursor, { ...scope, status: "completed" })).toThrow(
			InvalidPaginationCursor,
		);
		expect(() =>
			decodeProgressEntryCursor(cursor, {
				...scope,
				unitId: "019fa3ab-72a9-7792-b2e3-43aa8a9c755f",
			}),
		).toThrow(InvalidPaginationCursor);
	});

	it("uses the same effective-time key for cursor filtering and ordering", () => {
		const boundary = {
			sortAt: new Date("2026-07-20T12:00:00.000Z"),
			createdAt: new Date("2026-07-31T12:00:00.000Z"),
			id: EntryId,
		};
		const dialect = new PgDialect();
		const condition = progressEntryCursorCondition(boundary);
		if (!condition) throw new Error("Expected a cursor condition");
		const cursorQuery = dialect.sqlToQuery(condition);
		const orderQuery = dialect.sqlToQuery(sql.join([...progressEntryOrderBy], sql`, `));

		expect(cursorQuery.sql).toContain(
			'coalesce("unit_progress_entry"."occurred_at", "unit_progress_entry"."created_at")',
		);
		expect(cursorQuery.params).toEqual([
			boundary.sortAt,
			boundary.sortAt,
			boundary.createdAt.toISOString(),
			boundary.createdAt.toISOString(),
			boundary.id,
		]);
		expect(orderQuery.sql).toBe(
			'coalesce("unit_progress_entry"."occurred_at", "unit_progress_entry"."created_at") desc, "unit_progress_entry"."created_at" desc, "unit_progress_entry"."id" desc',
		);
	});

	it.each(["not-a-cursor", Buffer.from(JSON.stringify({ v: 1 })).toString("base64url")])(
		"rejects invalid cursor %s",
		(value) => {
			expect(() => decodeProgressEntryCursor(value, { unitId: UnitId })).toThrow(
				InvalidPaginationCursor,
			);
		},
	);
});
