import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
	rows: new Map<unknown, unknown[]>(),
	writes: [] as { table: unknown; values: unknown }[],
	deleted: [] as unknown[],
}));
vi.mock("../database", () => {
	const select = () => ({
		from: (table: unknown) => {
			const query = {
				where: () => query,
				limit: () => query,
				for: async () => state.rows.get(table) ?? [],
				then: (resolve: (rows: unknown[]) => unknown) => resolve(state.rows.get(table) ?? []),
			};
			return query;
		},
	});
	const tx = {
		select,
		insert: (table: unknown) => ({
			values: (values: unknown) => {
				state.writes.push({ table, values });
				return {
					onConflictDoUpdate: async () => undefined,
					onConflictDoNothing: async () => undefined,
				};
			},
		}),
		delete: (table: unknown) => ({
			where: async () => {
				state.deleted.push(table);
			},
		}),
	};
	return {
		database: { select, transaction: async (work: (value: typeof tx) => unknown) => work(tx) },
	};
});
vi.mock("../realms/service", () => ({ acknowledgeCurrentRealmRulesOnFollow: vi.fn() }));

import {
	accountRealmTagSubscription,
	accountFollowPreference,
	users,
	authEntity,
	unit,
} from "../database/schema";
import { FollowingTargetKindMismatch } from "./errors";
import { getFollowingStatus, replaceFollowingSettings } from "./service";

const authUserId = "019f94d1-c8ca-7110-b984-b0614ba4db99";
const followerProfileId = "019f94d1-c8ca-7110-b984-b0614ba4db9c";
const unitId = "019f94d1-c8ca-7110-b984-b0614ba4db9d";
const ensureCanRead = vi.fn(async () => undefined);
const input = { authUserId, followerProfileId, unitId, authorization: { ensureCanRead } };

beforeEach(() => {
	state.rows.clear();
	state.writes.length = 0;
	state.deleted.length = 0;
	state.rows.set(users, [{ id: authUserId }]);
	state.rows.set(authEntity, [{ id: followerProfileId }]);
	state.rows.set(unit, [{ id: unitId, kind: "realm" }]);
	state.rows.set(accountFollowPreference, [
		{ favorite: false, position: "a0V", inAppNotificationsEnabled: true },
	]);
});
describe("private Following settings", () => {
	it("reads the account's delivery and Tag-source choices", async () => {
		state.rows.set(accountRealmTagSubscription, [{ realmId: unitId }]);
		expect(await getFollowingStatus(input)).toEqual({
			following: true,
			kind: "realm",
			favorite: false,
			position: "a0V",
			inAppNotificationsEnabled: true,
			realmTagSourceSubscribed: true,
		});
	});
	it("writes actual Auth ownership while retaining the public self Entity reference", async () => {
		expect(
			await replaceFollowingSettings({
				...input,
				settings: {
					kind: "realm",
					inAppNotificationsEnabled: false,
					realmTagSourceSubscribed: true,
				},
			}),
		).toMatchObject({ inAppNotificationsEnabled: false, realmTagSourceSubscribed: true });
		expect(state.writes).toEqual([
			{
				table: accountFollowPreference,
				values: { authUserId, followerEntityId: followerProfileId, unitId, inApp: false },
			},
			{ table: accountRealmTagSubscription, values: { authUserId, realmId: unitId } },
		]);
	});
	it("removes the private Tag source without changing public follow identity", async () => {
		await replaceFollowingSettings({
			...input,
			settings: { kind: "realm", inAppNotificationsEnabled: true, realmTagSourceSubscribed: false },
		});
		expect(state.deleted).toEqual([accountRealmTagSubscription]);
		expect(state.writes[0]).toEqual({
			table: accountFollowPreference,
			values: { authUserId, followerEntityId: followerProfileId, unitId, inApp: true },
		});
	});
	it("rejects a target-kind mismatch before writing settings", async () => {
		await expect(
			replaceFollowingSettings({
				...input,
				settings: { kind: "book", inAppNotificationsEnabled: true, realmTagSourceSubscribed: null },
			}),
		).rejects.toThrow(FollowingTargetKindMismatch);
		expect(state.writes).toHaveLength(0);
	});
	it("does not expose private choices when self participation is unavailable", async () => {
		state.rows.set(authEntity, []);
		await expect(getFollowingStatus(input)).rejects.toThrow("Personal Following requires");
		expect(state.writes).toHaveLength(0);
	});
});
