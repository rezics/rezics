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

vi.mock("../database", () => ({
	database: {
		select: databaseSelect,
		transaction,
	},
}));
vi.mock("../realms/service", () => ({ acknowledgeCurrentRealmRulesOnFollow }));
vi.mock("../notifications/service", () => ({ createNotification }));

import { UnitKindValues } from "../database/schema/contract-values";
import { UserFollowBlocked, UserSelfFollowForbidden } from "./errors";
import { followUnit } from "./service";

const FollowerProfileId = "019f94d1-c8ca-7110-b984-b0614ba4db9c";
const TargetUnitId = "019f94d1-c8ca-7110-b984-b0614ba4db9d";

describe("followUnit", () => {
	const ensureCanRead = vi.fn(async () => undefined);

	beforeEach(() => {
		targetLimit.mockReset();
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
		insertReturning.mockResolvedValue([{ unitId: TargetUnitId }]);
		insertValues.mockReset();
		insertValues.mockImplementation(() => ({ onConflictDoNothing }));
		transactionInsert.mockReset();
		transactionInsert.mockImplementation(() => ({ values: insertValues }));
		transactionSelect.mockReset();
		transactionSelect.mockImplementation(() => ({
			from: vi.fn(() => ({
				where: vi.fn(() => ({ limit: blockedLimit })),
			})),
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

	it.each(UnitKindValues)("follows a readable %s Unit without a kind gate", async (kind) => {
		targetLimit.mockResolvedValue([{ id: TargetUnitId, kind }]);

		await expect(
			followUnit({
				followerProfileId: FollowerProfileId,
				unitId: TargetUnitId,
				authorization: { ensureCanRead },
			}),
		).resolves.toEqual({ following: true });

		expect(ensureCanRead).toHaveBeenCalledWith(TargetUnitId, expect.any(Function));
		expect(insertValues).toHaveBeenCalledWith({
			followerProfileId: FollowerProfileId,
			unitId: TargetUnitId,
		});
		expect(onConflictDoNothing).toHaveBeenCalledOnce();
		if (kind === "profile") expect(transactionSelect).toHaveBeenCalledOnce();
		else expect(transactionSelect).not.toHaveBeenCalled();
		if (kind === "realm")
			expect(acknowledgeCurrentRealmRulesOnFollow).toHaveBeenCalledWith(
				expect.anything(),
				TargetUnitId,
				FollowerProfileId,
			);
		else expect(acknowledgeCurrentRealmRulesOnFollow).not.toHaveBeenCalled();
		if (kind === "profile")
			expect(createNotification).toHaveBeenCalledWith(expect.anything(), {
				kind: "new_follower",
				recipientProfileId: TargetUnitId,
				actorProfileId: FollowerProfileId,
				dedupeKey: `new-follower:${FollowerProfileId}:${TargetUnitId}`,
			});
		else expect(createNotification).not.toHaveBeenCalled();
	});

	it("does not notify again when the follow already exists", async () => {
		targetLimit.mockResolvedValue([{ id: TargetUnitId, kind: "profile" }]);
		insertReturning.mockResolvedValue([]);

		await expect(
			followUnit({
				followerProfileId: FollowerProfileId,
				unitId: TargetUnitId,
				authorization: { ensureCanRead },
			}),
		).resolves.toEqual({ following: true });

		expect(createNotification).not.toHaveBeenCalled();
	});

	it("rejects following the caller's own Profile before writing", async () => {
		targetLimit.mockResolvedValue([{ id: FollowerProfileId, kind: "profile" }]);

		await expect(
			followUnit({
				followerProfileId: FollowerProfileId,
				unitId: FollowerProfileId,
				authorization: { ensureCanRead },
			}),
		).rejects.toBeInstanceOf(UserSelfFollowForbidden);

		expect(ensureCanRead).toHaveBeenCalledWith(FollowerProfileId, expect.any(Function));
		expect(transaction).not.toHaveBeenCalled();
		expect(transactionInsert).not.toHaveBeenCalled();
	});

	it("preserves blocking rules for Profile targets", async () => {
		targetLimit.mockResolvedValue([{ id: TargetUnitId, kind: "profile" }]);
		blockedLimit.mockResolvedValue([{ id: TargetUnitId }]);

		await expect(
			followUnit({
				followerProfileId: FollowerProfileId,
				unitId: TargetUnitId,
				authorization: { ensureCanRead },
			}),
		).rejects.toBeInstanceOf(UserFollowBlocked);

		expect(transactionSelect).toHaveBeenCalledOnce();
		expect(transactionInsert).not.toHaveBeenCalled();
	});

	it("requires read access before resolving or writing a follow target", async () => {
		const denied = new Error("denied");
		const ensureCanReadDenied = vi.fn(async () => {
			throw denied;
		});

		await expect(
			followUnit({
				followerProfileId: FollowerProfileId,
				unitId: TargetUnitId,
				authorization: { ensureCanRead: ensureCanReadDenied },
			}),
		).rejects.toBe(denied);

		expect(databaseSelect).not.toHaveBeenCalled();
		expect(transaction).not.toHaveBeenCalled();
	});
});
