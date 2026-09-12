import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
	rows: new Map<unknown, unknown[]>(),
	targetOwner: "realm",
	writes: [] as { table: unknown; values: unknown }[],
	deleted: [] as unknown[],
}));
vi.mock("../auth/account-state", () => ({
	ensureAccountAuthenticationAllowed: vi.fn(async () => undefined),
}));
vi.mock("../authorization/unit/access-lock", () => ({
	lockUnitAccessState: vi.fn(async () => undefined),
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
vi.mock("../units/query", () => ({
	readUnitStateById: async (_executor: unknown, id: string) => ({
		id,
		reference: { id, owner: state.targetOwner },
		shape: state.targetOwner,
	}),
}));
vi.mock("../units/reference-value", async (original) => ({
	...(await original<typeof import("../units/reference-value")>()),
	findReferenceValueByNativeId: vi.fn(async () => ({
		valueId: targetReferenceId,
		target: { owner: "post" as const, id: unitId },
	})),
}));
vi.mock("../realms/service", () => ({ acknowledgeCurrentRealmRulesOnFollow: vi.fn() }));

import {
	accountRealmTagSubscription,
	accountFollowPreference,
	users,
	authEntity,
} from "../database/schema";
import { FollowingTargetKindMismatch } from "./errors";
import { getFollowingStatus, replaceFollowingSettings } from "./service";

const authUserId = "019f94d1-c8ca-7110-b984-b0614ba4db99";
const followerProfileId = "019f94d1-c8ca-7110-b984-b0614ba4db9c";
const unitId = "019f94d1-c8ca-7110-b984-b0614ba4db9d";
const targetReferenceId = "019f94d1-c8ca-7110-b984-b0614ba4db9e";
const ensureCanRead = vi.fn(async () => ({ allowed: true as const, source: "public" as const }));
const authorization = {
	profileId: followerProfileId,
	authUserId,
	participationAuthority: {
		principal: { kind: "auth" as const, authUserId },
		actingEntityId: followerProfileId,
		authorizationRevision: 1,
	},
	account: {
		authUserId,
		ensureCanWrite: vi.fn(async () => undefined),
		ensureCanContribute: vi.fn(async () => undefined),
	},
	unit: {
		decideInTransaction: ensureCanRead,
		readableUnitIdsInTransaction: vi.fn(async () => new Set<string>()),
	},
};
const input = { authUserId, followerProfileId, unitId, authorization };

beforeEach(() => {
	state.rows.clear();
	state.writes.length = 0;
	state.deleted.length = 0;
	state.rows.set(users, [{ id: authUserId }]);
	state.rows.set(authEntity, [{ id: followerProfileId }]);
	state.targetOwner = "realm";
	state.rows.set(accountFollowPreference, [
		{ favorite: false, position: "a0V", inAppNotificationsEnabled: true },
	]);
});
describe("private Following settings", () => {
	it("reads the account's delivery and Tag-source choices", async () => {
		state.rows.set(accountRealmTagSubscription, [{ realmId: unitId }]);
		expect(await getFollowingStatus(input)).toEqual({
			following: true,
			owner: "realm",
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
					owner: "realm",
					inAppNotificationsEnabled: false,
					realmTagSourceSubscribed: true,
				},
			}),
		).toMatchObject({ inAppNotificationsEnabled: false, realmTagSourceSubscribed: true });
		expect(state.writes).toEqual([
			{
				table: accountFollowPreference,
				values: {
					authUserId,
					followerEntityId: followerProfileId,
					targetReferenceId,
					inApp: false,
				},
			},
			{ table: accountRealmTagSubscription, values: { authUserId, realmId: unitId } },
		]);
	});
	it("removes the private Tag source without changing public follow identity", async () => {
		await replaceFollowingSettings({
			...input,
			settings: {
				owner: "realm",
				inAppNotificationsEnabled: true,
				realmTagSourceSubscribed: false,
			},
		});
		expect(state.deleted).toEqual([accountRealmTagSubscription]);
		expect(state.writes[0]).toEqual({
			table: accountFollowPreference,
			values: { authUserId, followerEntityId: followerProfileId, targetReferenceId, inApp: true },
		});
	});
	it("rejects a target-kind mismatch before writing settings", async () => {
		await expect(
			replaceFollowingSettings({
				...input,
				settings: {
					owner: "publishing",
					inAppNotificationsEnabled: true,
					realmTagSourceSubscribed: null,
				},
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
