import { beforeEach, describe, expect, it, vi } from "vitest";

const targetLimit = vi.hoisted(() => vi.fn());
const blockedLimit = vi.hoisted(() => vi.fn());
const databaseSelect = vi.hoisted(() => vi.fn());
const transaction = vi.hoisted(() => vi.fn());
const transactionSelect = vi.hoisted(() => vi.fn());
const transactionInsert = vi.hoisted(() => vi.fn());
const insertValues = vi.hoisted(() => vi.fn());
const onConflictDoNothing = vi.hoisted(() => vi.fn());
const insertReturning = vi.hoisted(() => vi.fn());
const acknowledgeCurrentRealmRulesOnFollow = vi.hoisted(() => vi.fn());
const createNotification = vi.hoisted(() => vi.fn());

vi.mock("../auth/account-state", () => ({
	ensureAccountAuthenticationAllowed: vi.fn(async () => undefined),
}));
vi.mock("../authorization/unit/access-lock", () => ({
	lockUnitAccessState: vi.fn(async () => undefined),
}));
vi.mock("../database", () => ({
	database: {
		select: databaseSelect,
		transaction,
	},
}));
vi.mock("../units/query", () => ({
	readUnitStateById: async () => {
		const [row] = await targetLimit();
		return row ? { ...row, reference: { id: row.id, owner: row.kind } } : null;
	},
}));
vi.mock("../units/reference", () => ({
	resolveRegisteredUnitReference: async (_tx: unknown, id: string) => ({
		reference: { id, owner: (await targetLimit())[0]?.kind ?? "post" },
	}),
}));
vi.mock("../units/reference-value", async (original) => ({
	...(await original<typeof import("../units/reference-value")>()),
	allocateReferenceValue: vi.fn(async () => TargetReferenceId),
	findReferenceValueByNativeId: vi.fn(async () => ({
		valueId: TargetReferenceId,
		target: { owner: "post" as const, id: TargetUnitId },
	})),
}));
vi.mock("../realms/service", () => ({ acknowledgeCurrentRealmRulesOnFollow }));
vi.mock("../notifications/service", () => ({ createNotification }));

import { users, authEntity, unitMergeRedirect } from "../database/schema";
import { FollowableUnitOwnerValues } from "@rezics/schema/postgres/shared/contract-values";
import { UnitNotFound } from "../units/errors";
import { UserFollowBlocked, UserSelfFollowForbidden } from "./errors";
import { followUnit } from "./service";

const FollowerAuthUserId = "019f94d1-c8ca-7110-b984-b0614ba4db99";
const FollowerProfileId = "019f94d1-c8ca-7110-b984-b0614ba4db9c";
const TargetUnitId = "019f94d1-c8ca-7110-b984-b0614ba4db9d";
const TargetReferenceId = "019f94d1-c8ca-7110-b984-b0614ba4db9e";

describe("followUnit", () => {
	const ensureCanRead = vi.fn(async () => ({ allowed: true as const, source: "public" as const }));
	const authorization = {
		profileId: FollowerProfileId,
		authUserId: FollowerAuthUserId,
		participationAuthority: {
			principal: { kind: "auth" as const, authUserId: FollowerAuthUserId },
			actingEntityId: FollowerProfileId,
			authorizationRevision: 1,
		},
		account: {
			authUserId: FollowerAuthUserId,
			ensureCanWrite: vi.fn(async () => undefined),
			ensureCanContribute: vi.fn(async () => undefined),
		},
		unit: {
			decideInTransaction: ensureCanRead,
			readableUnitIdsInTransaction: vi.fn(async () => new Set<string>()),
		},
	};

	beforeEach(() => {
		targetLimit.mockReset();
		targetLimit.mockResolvedValue([]);
		blockedLimit.mockReset();
		blockedLimit.mockResolvedValue([]);
		databaseSelect.mockReset();
		databaseSelect.mockImplementation(() => ({
			from: vi.fn(() => ({
				where: vi.fn(() => ({ limit: targetLimit })),
			})),
		}));
		onConflictDoNothing.mockReset();
		onConflictDoNothing.mockReturnValue({ returning: insertReturning });
		insertReturning.mockReset();
		insertReturning.mockResolvedValue([{ targetReferenceId: TargetReferenceId }]);
		insertValues.mockReset();
		insertValues.mockImplementation(() => ({ onConflictDoNothing }));
		transactionInsert.mockReset();
		transactionInsert.mockImplementation(() => ({ values: insertValues }));
		transactionSelect.mockReset();
		transactionSelect.mockImplementation(() => ({
			from: vi.fn((table: unknown) =>
				table === unitMergeRedirect
					? { where: () => ({ limit: async () => [] }) }
					: table === users || table === authEntity
						? {
								where: () => ({ limit: () => ({ for: async () => [{ id: FollowerAuthUserId }] }) }),
							}
						: {
								where: vi.fn(() => ({ limit: blockedLimit })),
							},
			),
		}));
		transaction.mockReset();
		transaction.mockImplementation(
			async (
				operation: (executor: {
					select: typeof transactionSelect;
					insert: typeof transactionInsert;
				}) => unknown,
			) =>
				operation({
					select: transactionSelect,
					insert: transactionInsert,
				}),
		);
		ensureCanRead.mockClear();
		acknowledgeCurrentRealmRulesOnFollow.mockReset();
		acknowledgeCurrentRealmRulesOnFollow.mockResolvedValue(undefined);
		createNotification.mockReset();
		createNotification.mockResolvedValue(undefined);
	});

	it.each(FollowableUnitOwnerValues)("follows a readable %s Unit", async (kind) => {
		targetLimit.mockResolvedValue([{ id: TargetUnitId, kind }]);

		await expect(
			followUnit({
				authUserId: FollowerAuthUserId,
				followerProfileId: FollowerProfileId,
				unitId: TargetUnitId,
				authorization,
			}),
		).resolves.toEqual({ following: true });

		expect(ensureCanRead).toHaveBeenCalledWith(expect.anything(), TargetUnitId, "unit.read");
		expect(insertValues).toHaveBeenCalledWith({
			followerProfileId: FollowerProfileId,
			targetReferenceId: TargetReferenceId,
		});
		expect(onConflictDoNothing).toHaveBeenCalledTimes(2);
		if (kind === "entity") expect(transactionSelect).toHaveBeenCalledTimes(4);
		else expect(transactionSelect).toHaveBeenCalledTimes(3);
		if (kind === "realm")
			expect(acknowledgeCurrentRealmRulesOnFollow).toHaveBeenCalledWith(
				expect.anything(),
				TargetUnitId,
				FollowerProfileId,
			);
		else expect(acknowledgeCurrentRealmRulesOnFollow).not.toHaveBeenCalled();
		if (kind === "entity")
			expect(createNotification).toHaveBeenCalledWith(expect.anything(), {
				kind: "new_follower",
				recipientEntityId: TargetUnitId,
				actorProfileId: FollowerProfileId,
				dedupeKey: `new-follower:${FollowerProfileId}:${TargetUnitId}`,
			});
		else expect(createNotification).not.toHaveBeenCalled();
	});

	it("rejects Tag Path Units at the generic Following boundary", async () => {
		targetLimit.mockResolvedValue([{ id: TargetUnitId, kind: "tag_path" }]);

		await expect(
			followUnit({
				authUserId: FollowerAuthUserId,
				followerProfileId: FollowerProfileId,
				unitId: TargetUnitId,
				authorization,
			}),
		).rejects.toBeInstanceOf(UnitNotFound);
		expect(transactionInsert).not.toHaveBeenCalled();
	});

	it("does not notify again when the follow already exists", async () => {
		targetLimit.mockResolvedValue([{ id: TargetUnitId, kind: "entity" }]);
		insertReturning.mockResolvedValue([]);

		await expect(
			followUnit({
				authUserId: FollowerAuthUserId,
				followerProfileId: FollowerProfileId,
				unitId: TargetUnitId,
				authorization,
			}),
		).resolves.toEqual({ following: true });

		expect(createNotification).not.toHaveBeenCalled();
	});

	it("rejects following the caller's own Profile before writing", async () => {
		targetLimit.mockResolvedValue([{ id: FollowerProfileId, kind: "entity" }]);

		await expect(
			followUnit({
				authUserId: FollowerAuthUserId,
				followerProfileId: FollowerProfileId,
				unitId: FollowerProfileId,
				authorization,
			}),
		).rejects.toBeInstanceOf(UserSelfFollowForbidden);

		expect(ensureCanRead).toHaveBeenCalledWith(expect.anything(), FollowerProfileId, "unit.read");
		expect(transactionInsert).not.toHaveBeenCalled();
		expect(transactionInsert).not.toHaveBeenCalled();
	});

	it("preserves blocking rules for Profile targets", async () => {
		targetLimit.mockResolvedValue([{ id: TargetUnitId, kind: "entity" }]);
		blockedLimit.mockResolvedValue([{ id: TargetUnitId }]);

		await expect(
			followUnit({
				authUserId: FollowerAuthUserId,
				followerProfileId: FollowerProfileId,
				unitId: TargetUnitId,
				authorization,
			}),
		).rejects.toBeInstanceOf(UserFollowBlocked);

		expect(transactionSelect).toHaveBeenCalledTimes(4);
		expect(transactionInsert).not.toHaveBeenCalled();
	});

	it("requires current read access before writing a follow target", async () => {
		const denied = new Error("denied");
		const ensureCanReadDenied = vi.fn(async () => {
			throw denied;
		});

		await expect(
			followUnit({
				authUserId: FollowerAuthUserId,
				followerProfileId: FollowerProfileId,
				unitId: TargetUnitId,
				authorization: {
					...authorization,
					unit: { ...authorization.unit, decideInTransaction: ensureCanReadDenied },
				},
			}),
		).rejects.toBe(denied);

		expect(databaseSelect).not.toHaveBeenCalled();
		expect(transactionInsert).not.toHaveBeenCalled();
	});
});
