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
			{ realmId: RealmId, status: "current", publicationState: "active" },
			{ status: "hidden", updatedAt, unitId: UnitId },
		);

		expect(
			decodeRealmUnitModerationCursor(cursor, {
				realmId: RealmId,
				status: "current",
				publicationState: "active",
			}),
		).toEqual({
			status: "hidden",
			statusOrder: 1,
			updatedAt,
			unitId: UnitId,
		});
	});

	it("binds a cursor to its Realm and status filter", () => {
		const cursor = encodeRealmUnitModerationCursor(
			{
				realmId: RealmId,
				status: "pending",
				publicationState: "active",
				reported: true,
			},
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
				publicationState: "active",
				reported: true,
			}),
		).toThrow(InvalidPaginationCursor);
		expect(() =>
			decodeRealmUnitModerationCursor(cursor, {
				realmId: RealmId,
				status: "hidden",
				publicationState: "active",
				reported: true,
			}),
		).toThrow(InvalidPaginationCursor);
		expect(() =>
			decodeRealmUnitModerationCursor(cursor, {
				realmId: RealmId,
				status: "pending",
				publicationState: "active",
				reported: false,
			}),
		).toThrow(InvalidPaginationCursor);
		expect(() =>
			decodeRealmUnitModerationCursor(cursor, {
				realmId: RealmId,
				status: "pending",
				publicationState: "withdrawn",
				reported: true,
			}),
		).toThrow(InvalidPaginationCursor);
	});

	it("rejects malformed cursor values", () => {
		expect(() =>
			decodeRealmUnitModerationCursor("not-a-cursor", {
				realmId: RealmId,
				status: "current",
				publicationState: "active",
			}),
		).toThrow(InvalidPaginationCursor);
	});
});
