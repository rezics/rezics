import { describe, expect, it } from "vitest";

import { InvalidPaginationCursor } from "../../pagination/errors";
import {
	decodeRealmUnitModerationCursor,
	encodeRealmUnitModerationCursor,
} from "./moderation-pagination";

const RealmId = "019fa3ab-72a9-7792-b2e3-43aa8a9c755d";
const UnitId = "019fa3ab-72a9-7792-b2e3-43aa8a9c755e";

describe("Realm moderation pagination", () => {
	it("round-trips a status-ranked boundary", () => {
		const updatedAt = new Date("2026-07-27T12:34:56.789Z");
		const cursor = encodeRealmUnitModerationCursor(
			{ realmId: RealmId },
			{ status: "hidden", updatedAt, unitId: UnitId },
		);

		expect(decodeRealmUnitModerationCursor(cursor, { realmId: RealmId })).toEqual({
			status: "hidden",
			statusOrder: 1,
			updatedAt,
			unitId: UnitId,
		});
	});

	it("binds a cursor to its Realm and status filter", () => {
		const cursor = encodeRealmUnitModerationCursor(
			{ realmId: RealmId, status: "pending", reported: true },
			{
				status: "pending",
				updatedAt: new Date("2026-07-27T12:34:56.789Z"),
				unitId: UnitId,
			},
		);

		expect(() =>
			decodeRealmUnitModerationCursor(cursor, {
				realmId: "019fa3ab-72a9-7792-b2e3-43aa8a9c755f",
				status: "pending",
				reported: true,
			}),
		).toThrow(InvalidPaginationCursor);
		expect(() =>
			decodeRealmUnitModerationCursor(cursor, {
				realmId: RealmId,
				status: "hidden",
				reported: true,
			}),
		).toThrow(InvalidPaginationCursor);
		expect(() =>
			decodeRealmUnitModerationCursor(cursor, {
				realmId: RealmId,
				status: "pending",
				reported: false,
			}),
		).toThrow(InvalidPaginationCursor);
	});

	it("rejects malformed cursor values", () => {
		expect(() => decodeRealmUnitModerationCursor("not-a-cursor", { realmId: RealmId })).toThrow(
			InvalidPaginationCursor,
		);
	});
});
