import { beforeEach, describe, expect, it, vi } from "vitest";

const databaseSelect = vi.hoisted(() => vi.fn());
const transaction = vi.hoisted(() => vi.fn());

vi.mock("../database", () => ({
	database: {
		select: databaseSelect,
		transaction,
	},
}));
vi.mock("../realms/service", () => ({
	acknowledgeCurrentRealmRulesOnFollow: vi.fn(),
}));

import { profileRealmTagSubscription, unitFollowNotificationPreference } from "../database/schema";
import { FollowingTargetKindMismatch } from "./errors";
import { getFollowingStatus, replaceFollowingSettings } from "./service";

const FollowerProfileId = "019f94d1-c8ca-7110-b984-b0614ba4db9c";
const TargetUnitId = "019f94d1-c8ca-7110-b984-b0614ba4db9d";
const ensureCanRead = vi.fn(async () => undefined);

function selectBuilder(rows: readonly unknown[]) {
	return {
		from: vi.fn(() => ({
			where: vi.fn(() => ({
				limit: vi.fn(async () => rows),
			})),
		})),
	};
}

function joinedSelectBuilder(rows: readonly unknown[]) {
	return {
		from: vi.fn(() => ({
			leftJoin: vi.fn(() => ({
				where: vi.fn(() => ({
					limit: vi.fn(async () => rows),
				})),
			})),
		})),
	};
}

describe("following settings", () => {
	beforeEach(() => {
		databaseSelect.mockReset();
		transaction.mockReset();
		ensureCanRead.mockClear();
	});

	it("defaults an existing follow to in-app notifications and reads its Realm Tag source", async () => {
		databaseSelect
			.mockReturnValueOnce(selectBuilder([{ id: TargetUnitId, kind: "realm" }]))
			.mockReturnValueOnce(
				joinedSelectBuilder([
					{
						favorite: false,
						position: "a0V",
						inAppNotificationsEnabled: null,
					},
				]),
			)
			.mockReturnValueOnce(selectBuilder([{ realmId: TargetUnitId }]));

		await expect(
			getFollowingStatus({
				followerProfileId: FollowerProfileId,
				unitId: TargetUnitId,
				authorization: { ensureCanRead },
			}),
		).resolves.toEqual({
			following: true,
			kind: "realm",
			favorite: false,
			position: "a0V",
			inAppNotificationsEnabled: true,
			realmTagSourceSubscribed: true,
		});
	});

	it("atomically replaces notification and Realm Tag-source settings", async () => {
		databaseSelect.mockReturnValueOnce(selectBuilder([{ id: TargetUnitId, kind: "realm" }]));
		const preferenceConflict = vi.fn(async () => undefined);
		const tagConflict = vi.fn(async () => undefined);
		const insert = vi.fn((table) => ({
			values: vi.fn((values) => {
				if (table === unitFollowNotificationPreference) {
					expect(values).toEqual({
						followerProfileId: FollowerProfileId,
						unitId: TargetUnitId,
						inApp: false,
					});
					return { onConflictDoUpdate: preferenceConflict };
				}
				expect(table).toBe(profileRealmTagSubscription);
				expect(values).toEqual({
					profileId: FollowerProfileId,
					realmId: TargetUnitId,
				});
				return { onConflictDoNothing: tagConflict };
			}),
		}));
		transaction.mockImplementation(async (operation) =>
			operation({
				select: vi.fn(() => selectBuilder([{ favorite: true, position: "a1V" }])),
				insert,
			}),
		);

		await expect(
			replaceFollowingSettings({
				followerProfileId: FollowerProfileId,
				unitId: TargetUnitId,
				authorization: { ensureCanRead },
				settings: {
					kind: "realm",
					inAppNotificationsEnabled: false,
					realmTagSourceSubscribed: true,
				},
			}),
		).resolves.toEqual({
			following: true,
			kind: "realm",
			favorite: true,
			position: "a1V",
			inAppNotificationsEnabled: false,
			realmTagSourceSubscribed: true,
		});
		expect(transaction).toHaveBeenCalledOnce();
		expect(insert).toHaveBeenCalledTimes(2);
		expect(preferenceConflict).toHaveBeenCalledOnce();
		expect(tagConflict).toHaveBeenCalledOnce();
	});

	it("removes a Realm Tag source without coupling it to unfollowing", async () => {
		databaseSelect.mockReturnValueOnce(selectBuilder([{ id: TargetUnitId, kind: "realm" }]));
		const preferenceConflict = vi.fn(async () => undefined);
		const deleteWhere = vi.fn(async () => undefined);
		const remove = vi.fn((table) => {
			expect(table).toBe(profileRealmTagSubscription);
			return { where: deleteWhere };
		});
		transaction.mockImplementation(async (operation) =>
			operation({
				select: vi.fn(() => selectBuilder([{ favorite: false, position: "a0V" }])),
				insert: vi.fn((table) => {
					expect(table).toBe(unitFollowNotificationPreference);
					return {
						values: vi.fn(() => ({
							onConflictDoUpdate: preferenceConflict,
						})),
					};
				}),
				delete: remove,
			}),
		);

		await expect(
			replaceFollowingSettings({
				followerProfileId: FollowerProfileId,
				unitId: TargetUnitId,
				authorization: { ensureCanRead },
				settings: {
					kind: "realm",
					inAppNotificationsEnabled: true,
					realmTagSourceSubscribed: false,
				},
			}),
		).resolves.toMatchObject({
			following: true,
			kind: "realm",
			realmTagSourceSubscribed: false,
		});
		expect(remove).toHaveBeenCalledOnce();
		expect(deleteWhere).toHaveBeenCalledOnce();
	});

	it("rejects a stale target kind before opening a transaction", async () => {
		databaseSelect.mockReturnValueOnce(selectBuilder([{ id: TargetUnitId, kind: "realm" }]));

		await expect(
			replaceFollowingSettings({
				followerProfileId: FollowerProfileId,
				unitId: TargetUnitId,
				authorization: { ensureCanRead },
				settings: {
					kind: "book",
					inAppNotificationsEnabled: true,
					realmTagSourceSubscribed: null,
				},
			}),
		).rejects.toBeInstanceOf(FollowingTargetKindMismatch);
		expect(transaction).not.toHaveBeenCalled();
	});
});
