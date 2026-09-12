import { describe, expect, it, vi } from "vitest";
import type { DatabaseTransaction } from "../database";
import { authEntity, accountFollowPreference, unitFollow } from "../database/schema";
import { OfficialZoneManifest } from "./data";
import { ensureOfficialZoneFollows } from "./official-zone-follows";
const entityId = "019b76da-a800-7200-8000-000000000001";
const authUserId = "019b76da-a800-7100-8000-000000000001";

const referenceFor = (id: string) =>
	`00000000-0000-4000-8000-${String(OfficialZoneManifest.findIndex((zone) => zone.id === id) + 1).padStart(12, "0")}`;
vi.mock("../units/reference-value", async (original) => ({
	...(await original<typeof import("../units/reference-value")>()),
	allocateReferenceValue: vi.fn(async (_tx: unknown, target: { id: string }) =>
		referenceFor(target.id),
	),
}));

describe("official Zone defaults", () => {
	it("separates public follows from Auth-owned order without rewriting existing choices", async () => {
		const writes: { table: unknown; value: unknown }[] = [];
		const conflict = vi.fn(async () => undefined);
		const tx = {
			select: () => ({
				from: (table: unknown) => {
					const rows = table === authEntity ? [{ authUserId, entityId }] : [{ position: "a0" }];
					const query = {
						where: () => query,
						orderBy: () => query,
						limit: () => query,
						then: (resolve: (value: unknown) => unknown) => resolve(rows),
					};
					return query;
				},
			}),
			insert: (table: unknown) => ({
				values: (value: unknown) => {
					writes.push({ table, value });
					return { onConflictDoNothing: conflict };
				},
			}),
		} as unknown as DatabaseTransaction;
		await ensureOfficialZoneFollows(tx, [entityId]);
		expect(writes.filter((write) => write.table === unitFollow)).toEqual(
			OfficialZoneManifest.map((zone) => ({
				table: unitFollow,
				value: { followerProfileId: entityId, targetReferenceId: referenceFor(zone.id) },
			})),
		);
		expect(
			writes
				.filter((write) => write.table === accountFollowPreference)
				.every(
					(write) =>
						typeof write.value === "object" &&
						write.value !== null &&
						"authUserId" in write.value &&
						write.value.authUserId === authUserId,
				),
		).toBe(true);
		expect(conflict).toHaveBeenCalledTimes(OfficialZoneManifest.length * 2);
	});
	it("does not turn catalog subjects into account subscriptions", async () => {
		const insert = vi.fn();
		const tx = {
			select: () => ({ from: () => ({ where: async () => [] }) }),
			insert,
		} as unknown as DatabaseTransaction;
		await expect(ensureOfficialZoneFollows(tx, [entityId])).rejects.toThrow("admitted accounts");
		expect(insert).not.toHaveBeenCalled();
	});
});
