import { beforeEach, describe, expect, it, vi } from "vitest";

const recordUnitRevision = vi.hoisted(() => vi.fn());
const transitionUnitStatus = vi.hoisted(() => vi.fn());
const replaceAdaptedAudioUnitTracks = vi.hoisted(() => vi.fn());

vi.mock("./history", () => ({ recordUnitRevision }));
vi.mock("./status", () => ({ transitionUnitStatus }));
vi.mock("./video-audio-tracks", async (importOriginal) => ({
	...(await importOriginal<typeof import("./video-audio-tracks")>()),
	replaceAdaptedAudioUnitTracks,
}));

import type { DatabaseTransaction } from "../database";
import { video } from "../database/schema";
import { updateUnitInTransaction } from "./service";

const UnitId = "019b0000-0000-7000-8000-000000000001";
const ActorProfileId = "019b0000-0000-7000-8000-000000000002";
const ExpectedUpdatedAt = new Date("2026-08-03T10:00:00.123Z");

function transactionDouble(input?: {
	readonly unitUpdateResult?: readonly unknown[];
	readonly currentUnitResult?: readonly unknown[];
}) {
	const updates: Array<{ readonly table: unknown; readonly values: unknown }> = [];
	const update = vi.fn((table: unknown) => ({
		set: vi.fn((values: unknown) => {
			updates.push({ table, values });
			return {
				where: vi.fn(() =>
					table === video
						? {
								returning: vi.fn(async () =>
									Array.from(input?.unitUpdateResult ?? [{ id: UnitId, status: "draft" }]),
								),
							}
						: Promise.resolve(undefined),
				),
			};
		}),
	}));
	const limit = vi.fn(async () => Array.from(input?.currentUnitResult ?? []));
	const select = vi.fn(() => ({
		from: vi.fn(() => ({ where: vi.fn(() => ({ limit })) })),
	}));
	// This test double exposes exactly the transaction operations consumed by the mutation path.
	const transaction = { update, select } as unknown as DatabaseTransaction;
	return { transaction, updates, select, limit };
}

describe("Unit update transaction", () => {
	beforeEach(() => {
		recordUnitRevision.mockReset().mockResolvedValue({ revisionId: "revision-id" });
		transitionUnitStatus.mockReset().mockResolvedValue(undefined);
		replaceAdaptedAudioUnitTracks.mockReset().mockResolvedValue(undefined);
	});

 it("publishes one concrete Video row and records the authorized status transition",async()=>{
  const {transaction,updates}=transactionDouble();
  await updateUnitInTransaction(transaction,"video",UnitId,ActorProfileId,true,{expectedUpdatedAt:ExpectedUpdatedAt,status:"published"});
  expect(updates).toHaveLength(1);expect(updates[0]?.table).toBe(video);
  expect(transitionUnitStatus).toHaveBeenCalledWith(transaction,expect.objectContaining({unitId:UnitId,toStatus:"published",authorization:{kind:"interactive",statusUpdateAllowed:true},revisionId:"revision-id"}));
 });
 it("updates Video details on the same owner row",async()=>{
  const {transaction,updates}=transactionDouble();
  await updateUnitInTransaction(transaction,"video",UnitId,ActorProfileId,false,{expectedUpdatedAt:ExpectedUpdatedAt,details:{durationSeconds:3600}});
  expect(updates.map(update=>update.table)).toEqual([video]);
  expect(updates[0]?.values).toEqual(expect.objectContaining({durationSeconds:3600}));
  expect(transitionUnitStatus).not.toHaveBeenCalled();
 });
	it("updates visibility without issuing an empty subtype update", async () => {
		const { transaction, updates } = transactionDouble();

		await updateUnitInTransaction(transaction, "video", UnitId, ActorProfileId, false, {
			expectedUpdatedAt: ExpectedUpdatedAt,
			visibility: "unlisted",
		});

		expect(updates).toHaveLength(1);
		expect(updates[0]).toEqual({
			table: video,
			values: expect.objectContaining({
				visibility: "unlisted",
				updatedAt: expect.any(Date),
			}),
		});
	});

	it("returns the current token when optimistic concurrency fails", async () => {
		const currentUpdatedAt = new Date("2026-08-03T10:00:05.000Z");
		const { transaction } = transactionDouble({
			unitUpdateResult: [],
			currentUnitResult: [{ updatedAt: currentUpdatedAt }],
		});

		await expect(
			updateUnitInTransaction(transaction, "video", UnitId, ActorProfileId, false, {
				expectedUpdatedAt: ExpectedUpdatedAt,
				visibility: "unlisted",
			}),
		).rejects.toMatchObject({
			type: "UnitChanged",
			details: { updatedAt: currentUpdatedAt.toISOString() },
		});
		expect(recordUnitRevision).not.toHaveBeenCalled();
		expect(transitionUnitStatus).not.toHaveBeenCalled();
	});

	it("replaces adapted Audio only when the Video property is present", async () => {
		const audioId = "019b0000-0000-7000-8000-000000000003";
		const { transaction } = transactionDouble();

		await updateUnitInTransaction(transaction, "video", UnitId, ActorProfileId, false, {
			expectedUpdatedAt: ExpectedUpdatedAt,
			details: { adaptedAudioUnitIds: [audioId] },
		});
		expect(replaceAdaptedAudioUnitTracks).toHaveBeenCalledWith(transaction, UnitId, [audioId]);

		replaceAdaptedAudioUnitTracks.mockClear();
		await updateUnitInTransaction(transaction, "video", UnitId, ActorProfileId, false, {
			expectedUpdatedAt: ExpectedUpdatedAt,
		});
		expect(replaceAdaptedAudioUnitTracks).not.toHaveBeenCalled();
	});

	it("does not replace adapted Audio when the Unit compare-and-swap fails", async () => {
		const currentUpdatedAt = new Date("2026-08-03T10:00:05.000Z");
		const { transaction } = transactionDouble({
			unitUpdateResult: [],
			currentUnitResult: [{ updatedAt: currentUpdatedAt }],
		});

		await expect(
			updateUnitInTransaction(transaction, "video", UnitId, ActorProfileId, false, {
				expectedUpdatedAt: ExpectedUpdatedAt,
				details: { adaptedAudioUnitIds: null },
			}),
		).rejects.toMatchObject({ type: "UnitChanged" });
		expect(replaceAdaptedAudioUnitTracks).not.toHaveBeenCalled();
	});

	it("rejects adapted Audio replacement for non-Video Units before writing", async () => {
		const { transaction, updates } = transactionDouble();

		await expect(
			updateUnitInTransaction(transaction, "audio", UnitId, ActorProfileId, false, {
				expectedUpdatedAt: ExpectedUpdatedAt,
				details: { adaptedAudioUnitIds: null },
			}),
		).rejects.toMatchObject({
			type: "VideoAudioTrackInvalid",
			details: { path: "/details/adaptedAudioUnitIds" },
		});
		expect(updates).toEqual([]);
		expect(replaceAdaptedAudioUnitTracks).not.toHaveBeenCalled();
	});
});
