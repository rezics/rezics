import { beforeEach, describe, expect, it, vi } from "vitest";

const recordUnitRevision = vi.hoisted(() => vi.fn());
const transitionUnitStatus = vi.hoisted(() => vi.fn());
const ensureUnitVariantLifecycle = vi.hoisted(() => vi.fn());
const enqueueBookChapterDraftJobInTransaction = vi.hoisted(() => vi.fn());
const replaceAdaptedAudioUnitRelations = vi.hoisted(() => vi.fn());

vi.mock("./history", () => ({ recordUnitRevision }));
vi.mock("./status", () => ({ transitionUnitStatus }));
vi.mock("./variant-policy", () => ({
	ensureUnitVariantLifecycle,
	isDiscoverableVariantUnit: vi.fn(),
}));
vi.mock("./book-chapter-draft", async (importOriginal) => ({
	...(await importOriginal<typeof import("./book-chapter-draft")>()),
	enqueueBookChapterDraftJobInTransaction,
}));
vi.mock("./relations", async (importOriginal) => ({
	...(await importOriginal<typeof import("./relations")>()),
	replaceAdaptedAudioUnitRelations,
}));

import type { DatabaseTransaction } from "../database";
import { book, bookChapterDraftJob, unit } from "../database/schema";
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
					table === unit
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
		ensureUnitVariantLifecycle.mockReset().mockResolvedValue(undefined);
		enqueueBookChapterDraftJobInTransaction.mockReset().mockResolvedValue({
			id: "job-id",
			state: "pending",
		});
		replaceAdaptedAudioUnitRelations.mockReset().mockResolvedValue(undefined);
	});

	it("publishes with a status-only patch without issuing an empty Book update", async () => {
		const { transaction, updates } = transactionDouble();

		await updateUnitInTransaction(transaction, "book", UnitId, ActorProfileId, true, {
			expectedUpdatedAt: ExpectedUpdatedAt,
			status: "published",
		});

		expect(updates).toHaveLength(2);
		expect(updates[0]?.table).toBe(unit);
		expect(updates[0]?.values).toEqual(expect.objectContaining({ updatedAt: expect.any(Date) }));
		expect(updates[1]).toEqual({
			table: bookChapterDraftJob,
			values: expect.objectContaining({ state: "cancelled" }),
		});
		expect(transitionUnitStatus).toHaveBeenCalledWith(
			transaction,
			expect.objectContaining({
				unitId: UnitId,
				toStatus: "published",
				authorization: { kind: "interactive", statusUpdateAllowed: true },
			}),
		);
	});

	it("updates Book details without requiring a Unit lifecycle field", async () => {
		const { transaction, updates } = transactionDouble();

		await updateUnitInTransaction(transaction, "book", UnitId, ActorProfileId, false, {
			expectedUpdatedAt: ExpectedUpdatedAt,
			details: { releaseStatus: "ongoing", wordCount: 100_000 },
		});

		expect(updates.map(({ table }) => table)).toEqual([unit, book]);
		expect(updates[1]?.values).toEqual(
			expect.objectContaining({ releaseStatus: "ongoing", wordCount: 100_000 }),
		);
		expect(transitionUnitStatus).not.toHaveBeenCalled();
	});

	it("keeps an active Chapter draft job when the Book remains draft", async () => {
		const { transaction, updates } = transactionDouble();

		await updateUnitInTransaction(transaction, "book", UnitId, ActorProfileId, true, {
			expectedUpdatedAt: ExpectedUpdatedAt,
			status: "draft",
		});

		expect(updates.map(({ table }) => table)).toEqual([unit]);
	});

	it("atomically enqueues the Chapter command when a published Book becomes draft", async () => {
		const { transaction, updates } = transactionDouble({
			unitUpdateResult: [{ id: UnitId, status: "published" }],
		});

		await updateUnitInTransaction(transaction, "book", UnitId, ActorProfileId, true, {
			expectedUpdatedAt: ExpectedUpdatedAt,
			status: "draft",
			bookChapterDraftScope: "manageable_published_chapters",
		});

		expect(updates[1]).toEqual({
			table: bookChapterDraftJob,
			values: expect.objectContaining({ state: "cancelled" }),
		});
		expect(enqueueBookChapterDraftJobInTransaction).toHaveBeenCalledWith(transaction, {
			bookId: UnitId,
			bookUpdatedAt: expect.any(Date),
			requestedByProfileId: ActorProfileId,
		});
	});

	it("keeps Chapters independent when the Book-only draft scope is selected", async () => {
		const { transaction } = transactionDouble({
			unitUpdateResult: [{ id: UnitId, status: "published" }],
		});

		await updateUnitInTransaction(transaction, "book", UnitId, ActorProfileId, true, {
			expectedUpdatedAt: ExpectedUpdatedAt,
			status: "draft",
			bookChapterDraftScope: "book_only",
		});

		expect(transitionUnitStatus).toHaveBeenCalledWith(
			transaction,
			expect.objectContaining({ toStatus: "draft" }),
		);
		expect(enqueueBookChapterDraftJobInTransaction).not.toHaveBeenCalled();
	});

	it("updates visibility without issuing an empty subtype update", async () => {
		const { transaction, updates } = transactionDouble();

		await updateUnitInTransaction(transaction, "book", UnitId, ActorProfileId, false, {
			expectedUpdatedAt: ExpectedUpdatedAt,
			visibility: "unlisted",
		});

		expect(updates).toHaveLength(1);
		expect(updates[0]).toEqual({
			table: unit,
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
			updateUnitInTransaction(transaction, "book", UnitId, ActorProfileId, false, {
				expectedUpdatedAt: ExpectedUpdatedAt,
				visibility: "unlisted",
			}),
		).rejects.toMatchObject({
			_tag: "UnitChanged",
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
		expect(replaceAdaptedAudioUnitRelations).toHaveBeenCalledWith(transaction, UnitId, [audioId]);

		replaceAdaptedAudioUnitRelations.mockClear();
		await updateUnitInTransaction(transaction, "video", UnitId, ActorProfileId, false, {
			expectedUpdatedAt: ExpectedUpdatedAt,
		});
		expect(replaceAdaptedAudioUnitRelations).not.toHaveBeenCalled();
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
		).rejects.toMatchObject({ _tag: "UnitChanged" });
		expect(replaceAdaptedAudioUnitRelations).not.toHaveBeenCalled();
	});

	it("rejects adapted Audio replacement for non-Video Units before writing", async () => {
		const { transaction, updates } = transactionDouble();

		await expect(
			updateUnitInTransaction(transaction, "audio", UnitId, ActorProfileId, false, {
				expectedUpdatedAt: ExpectedUpdatedAt,
				details: { adaptedAudioUnitIds: null },
			}),
		).rejects.toMatchObject({
			_tag: "UnitRelationInvalid",
			details: { path: "/details/adaptedAudioUnitIds" },
		});
		expect(updates).toEqual([]);
		expect(replaceAdaptedAudioUnitRelations).not.toHaveBeenCalled();
	});
});
